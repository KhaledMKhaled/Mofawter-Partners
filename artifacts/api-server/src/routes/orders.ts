import { Router, type IRouter } from "express";
import {
  db,
  ordersTable,
  clientsTable,
  usersTable,
  commissionsTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
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
  salesId: number | null;
  salesName: string | null;
  distributorId: number | null;
  distributorName: string | null;
  orderName: string;
  amount: number;
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

  return rows.map((o) => {
    const client = clientMap.get(o.clientId);
    const sales = client ? userMap.get(client.assignedSalesId) : undefined;
    const dist = client ? userMap.get(client.assignedDistributorId) : undefined;
    return {
      id: o.id,
      clientId: o.clientId,
      clientName: client?.name ?? null,
      salesId: client?.assignedSalesId ?? null,
      salesName: sales?.name ?? null,
      distributorId: client?.assignedDistributorId ?? null,
      distributorName: dist?.name ?? null,
      orderName: o.orderName,
      amount: Number(o.amount),
      orderDate: o.orderDate.toISOString(),
      status: o.status,
      createdAt: o.createdAt.toISOString(),
    };
  });
}

router.get("/", async (req, res) => {
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
      res.json([]);
      return;
    }
    const all = await db
      .select()
      .from(ordersTable)
      .orderBy(desc(ordersTable.orderDate));
    rows = all.filter((o) => clientIds.includes(o.clientId));
  }
  res.json(await enrichOrders(rows));
});

router.post("/", async (req, res) => {
  const { role, sub } = req.auth!;
  const { clientId, orderName, amount } = req.body ?? {};
  if (!clientId || !orderName || amount === undefined || amount === null) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  const numericAmount = Number(amount);
  if (Number.isNaN(numericAmount) || numericAmount <= 0) {
    res.status(400).json({ error: "Amount must be a positive number" });
    return;
  }
  const [client] = await db
    .select()
    .from(clientsTable)
    .where(eq(clientsTable.id, Number(clientId)));
  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }
  if (role === "SALES" && client.assignedSalesId !== sub) {
    res.status(403).json({ error: "You do not own this client" });
    return;
  }
  if (role === "DISTRIBUTOR" && client.assignedDistributorId !== sub) {
    res.status(403).json({ error: "Client not in your team" });
    return;
  }
  const [created] = await db
    .insert(ordersTable)
    .values({
      clientId: client.id,
      orderName,
      amount: String(numericAmount),
    })
    .returning();
  const [enriched] = await enrichOrders([created]);
  res.status(201).json(enriched);
});

router.patch("/:id/status", async (req, res) => {
  const { role, sub } = req.auth!;
  const orderId = Number(req.params.id);
  const { status } = req.body ?? {};
  if (!["PENDING", "COMPLETED"].includes(status)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }
  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId));
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  const [client] = await db
    .select()
    .from(clientsTable)
    .where(eq(clientsTable.id, order.clientId));
  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }
  // Only ADMIN can mark COMPLETED in this MVP
  if (status === "COMPLETED" && role !== "ADMIN") {
    res.status(403).json({ error: "Only admins can mark orders completed" });
    return;
  }
  if (status === "PENDING" && role !== "ADMIN") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  // Prevent double-completion
  const wasCompleted = order.status === "COMPLETED";
  const rates = await getCommissionRates();

  await db.transaction(async (tx) => {
    await tx
      .update(ordersTable)
      .set({ status })
      .where(eq(ordersTable.id, orderId));

    // Apply 5-year ownership rule against the order PLACEMENT date,
    // not the completion time. An order placed within the window earns
    // commissions even if it is marked completed after the window closes;
    // an order placed outside the window never earns commissions.
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
      // Idempotency: clear any prior commissions for this order first
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
      // Reverting — refuse if any commission has already been paid out
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
  }).catch((err) => {
    if (err instanceof RevertBlockedError) {
      res.status(409).json({ error: err.message });
      return undefined;
    }
    throw err;
  });

  if (res.headersSent) return;

  const [refreshed] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId));
  const [enriched] = await enrichOrders([refreshed]);
  res.json(enriched);
});

export default router;
