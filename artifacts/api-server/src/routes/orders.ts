import { Router, type IRouter } from "express";
import {
  db,
  ordersTable,
  clientsTable,
  usersTable,
  packagesTable,
  commissionsTable,
  ORDER_STATUS_TRANSITIONS,
} from "@workspace/db";
import type { OrderStatus, OrderType } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { getCommissionRates, evaluateCommissionRule } from "../lib/commission";
import { planCommissionUpdate, validateStatusTransition, calculateOwnershipEndDate } from "../lib/ownership";
import { normalizeTaxCardNumber } from "../lib/tax-card";
import { logAudit, type AuditContext } from "../lib/audit";

const router: IRouter = Router();
router.use(requireAuth);

class RevertBlockedError extends Error {}

type EnrichedOrder = {
  id: number;
  clientId: number;
  clientName: string | null;
  taxCardNumber: string | null;
  packageId: number | null;
  packageName: string | null;
  salesId: number | null;
  salesName: string | null;
  distributorId: number | null;
  distributorName: string | null;
  orderName: string;
  orderType: OrderType;
  amount: number;
  vatAmount: number;
  receiptNumber: string | null;
  isFullyCollected: boolean;
  orderDate: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
};

type ClientDto = {
  id: number;
  name: string;
  taxCardNumber: string;
  taxCardName: string;
  issuingAuthority: string;
  commercialRegistryNumber: string;
  businessType: string;
  email: string;
  phone1: string;
  phone1WhatsApp: boolean;
  phone2: string | null;
  phone2WhatsApp: boolean;
  nationalId: string;
  address: string;
  assignedSalesId: number;
  assignedDistributorId: number;
  ownershipStartDate: string;
  ownershipEndDate: string;
  ownershipRuleType: string;
  ownershipStatus: string;
  createdAt: string;
};

function toClientDto(c: typeof clientsTable.$inferSelect): ClientDto {
  return {
    id: c.id,
    name: c.name,
    taxCardNumber: c.taxCardNumber,
    taxCardName: c.taxCardName,
    issuingAuthority: c.issuingAuthority,
    commercialRegistryNumber: c.commercialRegistryNumber,
    businessType: c.businessType,
    email: c.email,
    phone1: c.phone1,
    phone1WhatsApp: c.phone1WhatsApp,
    phone2: c.phone2,
    phone2WhatsApp: c.phone2WhatsApp,
    nationalId: c.nationalId,
    address: c.address,
    assignedSalesId: c.assignedSalesId,
    assignedDistributorId: c.assignedDistributorId,
    ownershipStartDate: c.ownershipStartDate.toISOString(),
    ownershipEndDate: c.ownershipEndDate.toISOString(),
    ownershipRuleType: c.ownershipRuleType,
    ownershipStatus: c.ownershipStatus,
    createdAt: c.createdAt.toISOString(),
  };
}

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

  const packageIds = [...new Set(rows.map((o) => o.packageId).filter((id): id is number => id !== null))];
  let packages: (typeof packagesTable.$inferSelect)[] = [];
  if (packageIds.length > 0) {
    packages = (await Promise.all(
      packageIds.map((id) => db.select().from(packagesTable).where(eq(packagesTable.id, id)))
    )).flat();
  }
  const pkgMap = new Map(packages.map((p) => [p.id, p]));

  return rows.map((o) => {
    const client = clientMap.get(o.clientId);
    const sales = client ? userMap.get(client.assignedSalesId) : undefined;
    const dist = client ? userMap.get(client.assignedDistributorId) : undefined;
    const pkg = o.packageId ? pkgMap.get(o.packageId) : undefined;

    return {
      id: o.id,
      clientId: o.clientId,
      clientName: client?.name ?? null,
      taxCardNumber: client?.taxCardNumber ?? null,
      packageId: o.packageId,
      packageName: pkg?.name ?? o.orderName,
      salesId: client?.assignedSalesId ?? null,
      salesName: sales?.name ?? null,
      distributorId: client?.assignedDistributorId ?? null,
      distributorName: dist?.name ?? null,
      orderName: o.orderName,
      orderType: o.orderType as OrderType,
      amount: Number(o.amount),
      vatAmount: Number(o.vatAmount),
      receiptNumber: o.receiptNumber,
      isFullyCollected: o.isFullyCollected,
      orderDate: o.orderDate.toISOString(),
      status: o.status as OrderStatus,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
    };
  });
}

// ============================================================================
// GET /orders — list orders scoped by role
// ============================================================================
router.get("/", async (req, res, next) => {
  try {
    const { role, sub } = req.auth!;
    let rows: (typeof ordersTable.$inferSelect)[];
    if (role === "ADMIN" || role === "OPERATIONS") {
      rows = await db
        .select()
        .from(ordersTable)
        .orderBy(desc(ordersTable.updatedAt));
    } else {
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
        .orderBy(desc(ordersTable.updatedAt));
      rows = all.filter((o) => clientIds.includes(o.clientId));
    }
    res.json(await enrichOrders(rows));
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// POST /orders — create order for an existing client (non-wizard path)
// ============================================================================
router.post("/", async (req, res, next) => {
  try {
    const { role, sub } = req.auth!;
    const { clientId, packageId, receiptNumber, isFullyCollected, orderType } = req.body ?? {};

    if (!clientId || !packageId || isFullyCollected === undefined) {
      res.status(400).json({ error: "Missing required fields" });
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

    // Check for in-progress orders (any non-terminal status)
    const terminalStatuses: OrderStatus[] = ["COMMISSION_PAID", "CANCELLED", "REJECTED"];
    const allClientOrders = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.clientId, client.id));
    const inProgressOrder = allClientOrders.find(
      (o) => !terminalStatuses.includes(o.status as OrderStatus),
    );
    if (inProgressOrder) {
      res.status(400).json({ error: "Client already has an in-progress order.", inProgressOrderId: inProgressOrder.id });
      return;
    }

    const [pkg] = await db
      .select()
      .from(packagesTable)
      .where(eq(packagesTable.id, Number(packageId)));

    if (!pkg) {
      res.status(404).json({ error: "Package not found" });
      return;
    }
    if (!pkg.isActive) {
      res.status(400).json({ error: "Package is not active" });
      return;
    }

    const price = Number(pkg.price);
    const vatPct = Number(pkg.vatPct);
    const vatAmount = (price * (vatPct / 100)).toFixed(2);
    const resolvedOrderType: OrderType = (orderType && ["NEW_SUBSCRIPTION", "RENEWAL", "UPGRADE", "ADD_ON"].includes(orderType))
      ? orderType as OrderType
      : "NEW_SUBSCRIPTION";

    const [created] = await db
      .insert(ordersTable)
      .values({
        clientId: client.id,
        packageId: pkg.id,
        orderName: pkg.name,
        orderType: resolvedOrderType,
        amount: pkg.price.toString(),
        vatAmount: vatAmount.toString(),
        receiptNumber: receiptNumber || null,
        isFullyCollected: isFullyCollected,
        status: "NEW",
      })
      .returning();

    // Audit log
    const authUser = req.auth!;
    const [userRow] = await db.select().from(usersTable).where(eq(usersTable.id, authUser.sub));
    await logAudit({
      ctx: { userId: authUser.sub, userName: userRow?.name ?? "Unknown", userRole: authUser.role },
      entityType: "order",
      entityId: created.id,
      actionType: "ORDER_CREATED",
      newValue: { status: "NEW", clientId: client.id, packageId: pkg.id },
    });

    const [enriched] = await enrichOrders([created]);
    res.status(201).json(enriched);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// POST /orders/unified — unified client+order creation wizard
// ============================================================================
router.post("/unified", async (req, res, next) => {
  try {
    const { role, sub } = req.auth!;
    const {
      taxCardNumber: rawTaxCardNumber,
      client,
      packageId,
      receiptNumber,
      isFullyCollected,
      orderType,
    } = req.body ?? {};
    const taxCardNumber = normalizeTaxCardNumber(rawTaxCardNumber);

    if (!taxCardNumber || !packageId || isFullyCollected === undefined) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const resolvedOrderType: OrderType = (orderType && ["NEW_SUBSCRIPTION", "RENEWAL", "UPGRADE", "ADD_ON"].includes(orderType))
      ? orderType as OrderType
      : "NEW_SUBSCRIPTION";

    const authUser = req.auth!;
    const [userRow] = await db.select().from(usersTable).where(eq(usersTable.id, authUser.sub));
    const auditCtx: AuditContext = {
      userId: authUser.sub,
      userName: userRow?.name ?? "Unknown",
      userRole: authUser.role,
    };

    const result = await db.transaction(async (tx) => {
      let [existingClient] = await tx
        .select()
        .from(clientsTable)
        .where(eq(clientsTable.taxCardNumber, taxCardNumber));

      if (!existingClient) {
        if (!client) {
          res.status(400).json({ error: "Client data is required for new tax cards" });
          return null;
        }

        const {
          name, assignedSalesId, taxCardName, issuingAuthority,
          commercialRegistryNumber, businessType, email, phone1,
          phone1WhatsApp, phone2, phone2WhatsApp, nationalId, address,
        } = client;

        if (!name || !taxCardName || !issuingAuthority || !commercialRegistryNumber ||
          !businessType || !email || !phone1 || !nationalId || !address) {
          res.status(400).json({ error: "Incomplete client data for new client creation" });
          return null;
        }

        let salesId: number;
        if (role === "SALES") {
          salesId = sub;
        } else if (role === "DISTRIBUTOR" || role === "ADMIN" || role === "OPERATIONS") {
          if (!assignedSalesId) {
            res.status(400).json({ error: "assignedSalesId is required" });
            return null;
          }
          salesId = Number(assignedSalesId);
        } else {
          res.status(403).json({ error: "Forbidden" });
          return null;
        }

        const [sales] = await tx
          .select()
          .from(usersTable)
          .where(and(eq(usersTable.id, salesId), eq(usersTable.role, "SALES")));
        if (!sales || !sales.distributorId) {
          res.status(400).json({ error: "Sales agent not found" });
          return null;
        }
        if (role === "DISTRIBUTOR" && sales.distributorId !== sub) {
          res.status(403).json({ error: "Sales agent does not belong to your team" });
          return null;
        }

        // Fetch package ownership duration for ownership window calculation
        const [pkg] = await tx.select().from(packagesTable).where(eq(packagesTable.id, Number(packageId)));
        const ownershipMonths = pkg?.ownershipDurationMonths ?? 60;

        const start = new Date();
        const end = calculateOwnershipEndDate(start, ownershipMonths);

        const [createdClient] = await tx
          .insert(clientsTable)
          .values({
            name, taxCardNumber, taxCardName, issuingAuthority,
            commercialRegistryNumber, businessType, email, phone1,
            phone1WhatsApp: phone1WhatsApp || false,
            phone2: phone2 || null,
            phone2WhatsApp: phone2WhatsApp || false,
            nationalId, address,
            assignedSalesId: salesId,
            assignedDistributorId: sales.distributorId,
            ownershipStartDate: start,
            ownershipEndDate: end,
            ownershipRuleType: "FIXED",
            ownershipStatus: "ACTIVE",
          })
          .returning();
        existingClient = createdClient;

        // Log client creation (done outside tx for safety — within tx is also fine)
        await logAudit({
          ctx: auditCtx,
          entityType: "client",
          entityId: createdClient.id,
          actionType: "CLIENT_CREATED",
          newValue: { name, taxCardNumber, salesId, distributorId: sales.distributorId },
        }).catch(console.error);
      }

      if (role === "SALES" && existingClient.assignedSalesId !== sub) {
        res.status(403).json({ error: "You do not own this client" });
        return null;
      }

      if (role === "DISTRIBUTOR" && existingClient.assignedDistributorId !== sub) {
        res.status(403).json({ error: "Client not in your team" });
        return null;
      }

      // Check for in-progress order
      const terminalStatuses: OrderStatus[] = ["COMMISSION_PAID", "CANCELLED", "REJECTED"];
      const allClientOrders = await tx
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.clientId, existingClient.id));
      const inProgressOrder = allClientOrders.find(
        (o) => !terminalStatuses.includes(o.status as OrderStatus),
      );
      if (inProgressOrder) {
        res.status(400).json({
          error: "Client already has an in-progress order.",
          inProgressOrderId: inProgressOrder.id,
          inProgressOrderStatus: inProgressOrder.status,
        });
        return null;
      }

      const [pkg] = await tx
        .select()
        .from(packagesTable)
        .where(eq(packagesTable.id, Number(packageId)));
      if (!pkg) {
        res.status(404).json({ error: "Package not found" });
        return null;
      }
      if (!pkg.isActive) {
        res.status(400).json({ error: "Package is not active" });
        return null;
      }

      const price = Number(pkg.price);
      const vatPct = Number(pkg.vatPct);
      const vatAmount = (price * (vatPct / 100)).toFixed(2);

      const [createdOrder] = await tx
        .insert(ordersTable)
        .values({
          clientId: existingClient.id,
          packageId: pkg.id,
          orderName: pkg.name,
          orderType: resolvedOrderType,
          amount: pkg.price.toString(),
          vatAmount: vatAmount.toString(),
          receiptNumber: receiptNumber || null,
          isFullyCollected,
          status: "NEW",
        })
        .returning();

      return { client: existingClient, order: createdOrder };
    });

    if (!result) {
      return;
    }

    await logAudit({
      ctx: auditCtx,
      entityType: "order",
      entityId: result.order.id,
      actionType: "ORDER_CREATED",
      newValue: { status: "NEW", clientId: result.client.id, packageId, orderType: resolvedOrderType },
    });

    const [enrichedOrder] = await enrichOrders([result.order]);
    res.status(201).json({
      client: toClientDto(result.client),
      order: enrichedOrder,
    });
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(400).json({ error: "Tax card number already exists" });
      return;
    }
    next(err);
  }
});

// ============================================================================
// PATCH /orders/:id/status — strict status transition with Admin override
// ============================================================================
router.patch("/:id/status", async (req, res, next) => {
  try {
    const { role, sub } = req.auth!;
    const orderId = Number(req.params.id);
    const { status: newStatus, reason } = req.body ?? {};

    // Validate the new status is a known value
    const validStatuses = [
      "NEW", "UNDER_REVIEW", "APPROVED", "REJECTED", "IN_EXECUTION",
      "EXECUTED", "COLLECTED", "COMMISSION_PENDING", "COMMISSION_READY",
      "COMMISSION_PAID", "CANCELLED",
    ];
    if (!validStatuses.includes(newStatus)) {
      res.status(400).json({ error: "Invalid status value" });
      return;
    }

    // Only ADMIN and OPERATIONS can update order status
    if (role !== "ADMIN" && role !== "OPERATIONS") {
      res.status(403).json({ error: "Only Admin and Operations users can update order status" });
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

    const prevStatus = order.status as OrderStatus;
    const isAdmin = role === "ADMIN";

    // Validate the transition
    const transition = validateStatusTransition(prevStatus, newStatus as OrderStatus, isAdmin);
    if (!transition.valid) {
      res.status(400).json({ error: transition.reason ?? "Invalid status transition" });
      return;
    }

    // Admin override requires a reason
    if (transition.isOverride && !reason) {
      res.status(400).json({ error: "A reason is required when performing an admin status override" });
      return;
    }

    // Get commission rates and trigger config
    const { salesPct, distributorPct, commissionTriggerStatus } = await getCommissionRates();

    // Evaluate commission rules
    const salesRule = await evaluateCommissionRule({
      packageId: order.packageId,
      eventType: (order.orderType ?? "NEW_SUBSCRIPTION") as any,
      beneficiaryType: "SALES",
      globalFallbackPct: salesPct,
    });
    const distRule = await evaluateCommissionRule({
      packageId: order.packageId,
      eventType: (order.orderType ?? "NEW_SUBSCRIPTION") as any,
      beneficiaryType: "DISTRIBUTOR",
      globalFallbackPct: distributorPct,
    });

    let revertError: string | null = null;

    try {
      await db.transaction(async (tx) => {
        // Update the order status
        await tx
          .update(ordersTable)
          .set({ status: newStatus, updatedAt: new Date() })
          .where(eq(ordersTable.id, orderId));

        const plan = planCommissionUpdate({
          prevStatus,
          newStatus: newStatus as OrderStatus,
          isAdminOverride: transition.isOverride,
          orderDate: order.orderDate,
          orderType: (order.orderType ?? "NEW_SUBSCRIPTION") as any,
          packageId: order.packageId,
          amount: Number(order.amount),
          ownershipStartDate: client.ownershipStartDate,
          ownershipEndDate: client.ownershipEndDate,
          ownershipStatus: client.ownershipStatus,
          assignedSalesId: client.assignedSalesId,
          assignedDistributorId: client.assignedDistributorId,
          clientId: client.id,
          commissionTriggerStatus,
          salesRule,
          distRule,
        });

        if (plan.kind === "create") {
          // Delete any existing commissions for idempotency
          await tx
            .delete(commissionsTable)
            .where(and(
              eq(commissionsTable.orderId, orderId),
              eq(commissionsTable.status, "PENDING"),
            ));
          await tx.insert(commissionsTable).values(
            plan.commissions.map((c) => ({
              orderId: order.id,
              clientId: c.clientId,
              userId: c.userId,
              baseAmount: String(c.baseAmount),
              amount: String(c.amount),
              roleType: c.roleType,
              commissionType: c.commissionType,
              appliedRuleId: c.appliedRuleId,
              status: "PENDING" as const,
            })),
          );
        } else if (plan.kind === "delete") {
          const existing = await tx
            .select()
            .from(commissionsTable)
            .where(eq(commissionsTable.orderId, orderId));
          const paid = existing.filter((c) => c.status === "PAID" || c.status === "APPROVED" || c.status === "READY_FOR_PAYOUT");
          if (paid.length > 0) {
            throw new RevertBlockedError(
              "Cannot change status: one or more commissions are already approved or paid.",
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
      res.status(409).json({ error: revertError });
      return;
    }

    // Audit log the status change
    const [userRow] = await db.select().from(usersTable).where(eq(usersTable.id, sub));
    await logAudit({
      ctx: { userId: sub, userName: userRow?.name ?? "Unknown", userRole: role },
      entityType: "order",
      entityId: orderId,
      actionType: transition.isOverride ? "ORDER_STATUS_ADMIN_OVERRIDE" : "ORDER_STATUS_CHANGED",
      previousValue: { status: prevStatus },
      newValue: { status: newStatus },
      reason: reason ?? null,
    });

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

// ============================================================================
// GET /orders/transitions — return valid next statuses for a given current status
// ============================================================================
router.get("/transitions", (req, res) => {
  const { status } = req.query;
  if (!status || typeof status !== "string") {
    res.json(ORDER_STATUS_TRANSITIONS);
    return;
  }
  const allowed = ORDER_STATUS_TRANSITIONS[status as OrderStatus] ?? [];
  res.json({ from: status, allowedTransitions: allowed });
});

export default router;
