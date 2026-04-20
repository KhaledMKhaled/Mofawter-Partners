import { Router, type IRouter } from "express";
import {
  db,
  ordersTable,
  clientsTable,
  usersTable,
  packagesTable,
  commissionsTable,
} from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { getCommissionRates } from "../lib/commission";
import { planCommissionUpdate } from "../lib/ownership";

const router: IRouter = Router();
router.use(requireAuth);

class RevertBlockedError extends Error {}

type EnrichedOrder = {
  id: number;
  clientId: number;
  clientName: string | null;
  packageId: number | null;
  packageName: string | null;
  salesId: number | null;
  salesName: string | null;
  distributorId: number | null;
  distributorName: string | null;
  orderName: string;
  amount: number;
  vatAmount: number;
  receiptNumber: string | null;
  isFullyCollected: boolean;
  orderDate: string;
  status: "PENDING" | "COMPLETED";
  createdAt: string;
};

async function enrichOrders(
  rows: (typeof ordersTable.$inferSelect)[],
): Promise<EnrichedOrder[]> {
  if (rows.length === 0) return [];
  const clientIds = [...new Set(rows.map((o) => o.clientId))];
  const clients = await Promise.all(
    clientIds.map((id) =>
      db.select().from(clientsTable).where(eq(clientsTable.id, id)),
    ),
  );
  const clientMap = new Map(
    clients.flat().map((c) => [c.id, c]),
  );
  const userIds = new Set<number>();
  for (const c of clientMap.values()) {
    userIds.add(c.assignedSalesId);
    userIds.add(c.assignedDistributorId);
  }
  const userList = await Promise.all(
    [...userIds].map((id) =>
      db.select().from(usersTable).where(eq(usersTable.id, id)),
    ),
  );
  const userMap = new Map(userList.flat().map((u) => [u.id, u]));

  // Also pre-fetch packages to get names just in case, though orderName has it.
  const packageIds = [...new Set(rows.map((o) => o.packageId).filter(id => id !== null) as number[])];
  let packages: (typeof packagesTable.$inferSelect)[] = [];
  if (packageIds.length > 0) {
    packages = (await Promise.all(
      packageIds.map(id => db.select().from(packagesTable).where(eq(packagesTable.id, id)))
    )).flat();
  }
  const pkgMap = new Map(packages.map(p => [p.id, p]));

  return rows.map((o) => {
    const client = clientMap.get(o.clientId);
    const sales = client ? userMap.get(client.assignedSalesId) : undefined;
    const dist = client ? userMap.get(client.assignedDistributorId) : undefined;
    const pkg = o.packageId ? pkgMap.get(o.packageId) : undefined;
    
    return {
      id: o.id,
      clientId: o.clientId,
      clientName: client?.name ?? null,
      packageId: o.packageId,
      packageName: pkg?.name ?? o.orderName,
      salesId: client?.assignedSalesId ?? null,
      salesName: sales?.name ?? null,
      distributorId: client?.assignedDistributorId ?? null,
      distributorName: dist?.name ?? null,
      orderName: o.orderName,
      amount: Number(o.amount),
      vatAmount: Number(o.vatAmount),
      receiptNumber: o.receiptNumber,
      isFullyCollected: o.isFullyCollected,
      orderDate: o.orderDate.toISOString(),
      status: o.status,
      createdAt: o.createdAt.toISOString(),
    };
  });
}

router.get("/", async (req, res, next) => {
  try {
    const { role, sub } = req.auth!;
    let rows: (typeof ordersTable.$inferSelect)[];
    if (role === "ADMIN") {
      rows = await db
        .select()
        .from(ordersTable)
        .orderBy(desc(ordersTable.orderDate));
    } else {
      // Filter via client ownership
      const clients =
        role === "DISTRIBUTOR"
          ? await db
              .select()
              .from(clientsTable)
              .where(eq(clientsTable.assignedDistributorId, sub))
          : await db
              .select()
              .from(clientsTable)
              .where(eq(clientsTable.assignedSalesId, sub));
      const clientIds = clients.map((c) => c.id);
      if (clientIds.length === 0) {
        res.json([]);;
      return;
      }
      const all = await db
        .select()
        .from(ordersTable)
        .orderBy(desc(ordersTable.orderDate));
      rows = all.filter((o) => clientIds.includes(o.clientId));
    }
    res.json(await enrichOrders(rows));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { role, sub } = req.auth!;
    const { clientId, packageId, receiptNumber, isFullyCollected } = req.body ?? {};
    
    if (!clientId || !packageId || isFullyCollected === undefined) {
      res.status(400).json({ error: "Missing required fields" });;
      return;
    }

    const [client] = await db
      .select()
      .from(clientsTable)
      .where(eq(clientsTable.id, Number(clientId)));

    if (!client) {
      res.status(404).json({ error: "Client not found" });;
      return;
    }

    if (role === "SALES" && client.assignedSalesId !== sub) {
      res.status(403).json({ error: "You do not own this client" });;
      return;
    }

    if (role === "DISTRIBUTOR" && client.assignedDistributorId !== sub) {
      res.status(403).json({ error: "Client not in your team" });;
      return;
    }

    // CHECK FOR PENDING ORDER
    const [pendingOrder] = await db
      .select()
      .from(ordersTable)
      .where(and(eq(ordersTable.clientId, client.id), eq(ordersTable.status, "PENDING")))
      .limit(1);

    if (pendingOrder) {
      res.status(400).json({ error: "Client already has a pending order." });;
      return;
    }

    // GET PACKAGE DETAILS
    const [pkg] = await db
      .select()
      .from(packagesTable)
      .where(eq(packagesTable.id, Number(packageId)));

    if (!pkg) {
      res.status(404).json({ error: "Package not found" });;
      return;
    }

    if (!pkg.isActive) {
      res.status(400).json({ error: "Package is not active" });;
      return;
    }

    const price = Number(pkg.price);
    const vatPct = Number(pkg.vatPct);
    const vatAmount = (price * (vatPct / 100)).toFixed(2);

    const [created] = await db
      .insert(ordersTable)
      .values({
        clientId: client.id,
        packageId: pkg.id,
        orderName: pkg.name,
        amount: pkg.price.toString(),
        vatAmount: vatAmount.toString(),
        receiptNumber: receiptNumber || null,
        isFullyCollected: isFullyCollected,
        status: "PENDING"
      })
      .returning();

    const [enriched] = await enrichOrders([created]);
    res.status(201).json(enriched);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/status", async (req, res, next) => {
  try {
    const { role, sub } = req.auth!;
    const orderId = Number(req.params.id);
    const { status } = req.body ?? {};
    if (!["PENDING", "COMPLETED"].includes(status)) {
      res.status(400).json({ error: "Invalid status" });;
      return;
    }
    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId));
    if (!order) {
      res.status(404).json({ error: "Order not found" });;
      return;
    }
    const [client] = await db
      .select()
      .from(clientsTable)
      .where(eq(clientsTable.id, order.clientId));
    if (!client) {
      res.status(404).json({ error: "Client not found" });;
      return;
    }
    
    if (status === "COMPLETED" && role !== "ADMIN") {
      res.status(403).json({ error: "Only admins can mark orders completed" });;
      return;
    }
    if (status === "PENDING" && role !== "ADMIN") {
      res.status(403).json({ error: "Forbidden" });;
      return;
    }
    
    const wasCompleted = order.status === "COMPLETED";
    const rates = await getCommissionRates();

    let revertError: string | null = null;

    try {
      await db.transaction(async (tx) => {
        await tx
          .update(ordersTable)
          .set({ status })
          .where(eq(ordersTable.id, orderId));

        const plan = planCommissionUpdate({
          prevStatus: order.status,
          newStatus: status,
          orderDate: order.orderDate,
          amount: Number(order.amount),
          ownershipStartDate: client.ownershipStartDate,
          ownershipEndDate: client.ownershipEndDate,
          assignedSalesId: client.assignedSalesId,
          assignedDistributorId: client.assignedDistributorId,
          rates,
        });

        if (plan.kind === "create") {
          await tx
            .delete(commissionsTable)
            .where(eq(commissionsTable.orderId, orderId));
          await tx.insert(commissionsTable).values(
            plan.commissions.map((c) => ({
              orderId: order.id,
              userId: c.userId,
              amount: String(c.amount),
              roleType: c.roleType,
            })),
          );
        } else if (plan.kind === "delete") {
          const existing = await tx
            .select()
            .from(commissionsTable)
            .where(eq(commissionsTable.orderId, orderId));
          const paid = existing.filter((c) => c.status === "PAID");
          if (paid.length > 0) {
            throw new RevertBlockedError(
              "Cannot revert order: one or more commissions have already been marked as PAID.",
            );
          }
          await tx
            .delete(commissionsTable)
            .where(eq(commissionsTable.orderId, orderId));
        }
      });
    } catch (err) {
      if (err instanceof RevertBlockedError) {
        revertError = err.message;
      } else {
        throw err;
      }
    }

    if (revertError) {
      res.status(409).json({ error: revertError });;
      return;
    }

    const [refreshed] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId));
    const [enriched] = await enrichOrders([refreshed]);
    res.json(enriched);
  } catch (err) {
    next(err);
  }
});

export default router;
