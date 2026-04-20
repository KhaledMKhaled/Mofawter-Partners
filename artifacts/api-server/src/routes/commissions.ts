import { Router, type IRouter } from "express";
import {
  db,
  commissionsTable,
  ordersTable,
  clientsTable,
  usersTable,
} from "@workspace/db";
import { eq, desc, inArray, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();
router.use(requireAuth);

type EnrichedCommission = {
  id: number;
  orderId: number;
  orderName: string | null;
  clientId: number;
  clientName: string | null;
  taxCardNumber: string | null;
  userId: number;
  userName: string | null;
  distributorName: string | null;
  baseAmount: number;
  amount: number;
  roleType: "SALES" | "DISTRIBUTOR";
  commissionType: string;
  status: string;
  appliedRuleId: number | null;
  paymentBatchId: number | null;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  paidByUserId: number | null;
  paidByName: string | null;
};

async function enrich(
  rows: (typeof commissionsTable.$inferSelect)[],
): Promise<EnrichedCommission[]> {
  if (rows.length === 0) return [];
  const orderIds = [...new Set(rows.map((c) => c.orderId))];
  const userIds = [
    ...new Set([
      ...rows.map((c) => c.userId),
      ...rows
        .map((c) => c.paidByUserId)
        .filter((v): v is number => v !== null && v !== undefined),
    ]),
  ];
  const orders = (
    await Promise.all(
      orderIds.map((id) =>
        db.select().from(ordersTable).where(eq(ordersTable.id, id)),
      ),
    )
  ).flat();
  const orderMap = new Map(orders.map((o) => [o.id, o]));
  const clientIds = [...new Set([...rows.map((c) => c.clientId), ...orders.map((o) => o.clientId)])];
  const clients = (
    await Promise.all(
      clientIds.map((id) =>
        db.select().from(clientsTable).where(eq(clientsTable.id, id)),
      ),
    )
  ).flat();
  const clientMap = new Map(clients.map((c) => [c.id, c]));
  const users = (
    await Promise.all(
      userIds.map((id) =>
        db.select().from(usersTable).where(eq(usersTable.id, id)),
      ),
    )
  ).flat();
  const userMap = new Map(users.map((u) => [u.id, u]));

  // Also fetch distributors for enriched display
  const distributorIds = [...new Set(clients.map((c) => c.assignedDistributorId))];
  const distributors = (
    await Promise.all(
      distributorIds.map((id) =>
        db.select().from(usersTable).where(eq(usersTable.id, id)),
      ),
    )
  ).flat();
  const distributorMap = new Map(distributors.map((u) => [u.id, u]));

  return rows.map((c) => {
    const order = orderMap.get(c.orderId);
    const client = clientMap.get(c.clientId) ?? (order ? clientMap.get(order.clientId) : undefined);
    const user = userMap.get(c.userId);
    const paidBy = c.paidByUserId ? userMap.get(c.paidByUserId) : undefined;
    const distributor = client ? distributorMap.get(client.assignedDistributorId) : undefined;

    return {
      id: c.id,
      orderId: c.orderId,
      orderName: order?.orderName ?? null,
      clientId: c.clientId,
      clientName: client?.name ?? null,
      taxCardNumber: client?.taxCardNumber ?? null,
      userId: c.userId,
      userName: user?.name ?? null,
      distributorName: distributor?.name ?? null,
      baseAmount: Number(c.baseAmount),
      amount: Number(c.amount),
      roleType: c.roleType as "SALES" | "DISTRIBUTOR",
      commissionType: c.commissionType,
      status: c.status,
      appliedRuleId: c.appliedRuleId ?? null,
      paymentBatchId: c.paymentBatchId ?? null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      paidAt: c.paidAt ? c.paidAt.toISOString() : null,
      paidByUserId: c.paidByUserId ?? null,
      paidByName: paidBy?.name ?? null,
    };
  });
}

// ============================================================================
// GET /commissions — list commissions scoped by role
// ============================================================================
router.get("/", async (req, res) => {
  const { role, sub } = req.auth!;
  let rows;
  if (role === "ADMIN" || role === "OPERATIONS") {
    rows = await db
      .select()
      .from(commissionsTable)
      .orderBy(desc(commissionsTable.createdAt));
  } else if (role === "DISTRIBUTOR") {
    const team = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.distributorId, sub));
    const allowedUserIds = new Set<number>([sub, ...team.map((u) => u.id)]);
    const all = await db
      .select()
      .from(commissionsTable)
      .orderBy(desc(commissionsTable.createdAt));
    rows = all.filter((c) => allowedUserIds.has(c.userId));
  } else {
    rows = await db
      .select()
      .from(commissionsTable)
      .where(eq(commissionsTable.userId, sub))
      .orderBy(desc(commissionsTable.createdAt));
  }
  res.json(await enrich(rows));
});

// ============================================================================
// PATCH /commissions/:id/status — Admin/Operations status transition
// ============================================================================
router.patch("/:id/status", requireRole("ADMIN", "OPERATIONS"), async (req, res) => {
  const { sub, role } = req.auth!;
  const id = Number(req.params.id);
  const { status } = req.body ?? {};

  const validStatuses = ["PENDING", "APPROVED", "READY_FOR_PAYOUT", "PAID", "CANCELLED"];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: "Invalid status. Must be one of: " + validStatuses.join(", ") });
    return;
  }

  const [existing] = await db
    .select()
    .from(commissionsTable)
    .where(eq(commissionsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Commission not found" });
    return;
  }

  if (existing.status === status) {
    const [enriched] = await enrich([existing]);
    res.json(enriched);
    return;
  }

  const updates: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
  };
  if (status === "PAID") {
    updates.paidAt = new Date();
    updates.paidByUserId = sub;
  } else if (existing.status === "PAID") {
    updates.paidAt = null;
    updates.paidByUserId = null;
  }

  await db
    .update(commissionsTable)
    .set(updates as any)
    .where(eq(commissionsTable.id, id));

  const [userRow] = await db.select().from(usersTable).where(eq(usersTable.id, sub));
  await logAudit({
    ctx: { userId: sub, userName: userRow?.name ?? "Unknown", userRole: role! },
    entityType: "commission",
    entityId: id,
    actionType: "COMMISSION_STATUS_CHANGED",
    previousValue: { status: existing.status },
    newValue: { status },
  });

  const [refreshed] = await db
    .select()
    .from(commissionsTable)
    .where(eq(commissionsTable.id, id));
  const [enriched] = await enrich([refreshed]);
  res.json(enriched);
});

// ============================================================================
// POST /commissions/mark-paid — bulk mark as PAID (Admin/Operations)
// ============================================================================
router.post("/mark-paid", requireRole("ADMIN", "OPERATIONS"), async (req, res) => {
  const { sub, role } = req.auth!;
  const { ids } = req.body ?? {};
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "ids must be a non-empty array" });
    return;
  }
  const numericIds = ids.map((v) => Number(v)).filter((n) => Number.isFinite(n));
  if (numericIds.length === 0) {
    res.status(400).json({ error: "ids must contain valid integers" });
    return;
  }
  await db
    .update(commissionsTable)
    .set({
      status: "PAID",
      paidAt: new Date(),
      paidByUserId: sub,
      updatedAt: new Date(),
    })
    .where(
      and(
        inArray(commissionsTable.id, numericIds),
        eq(commissionsTable.status, "READY_FOR_PAYOUT"),
      ),
    );

  const [userRow] = await db.select().from(usersTable).where(eq(usersTable.id, sub));
  for (const commId of numericIds) {
    await logAudit({
      ctx: { userId: sub, userName: userRow?.name ?? "Unknown", userRole: role! },
      entityType: "commission",
      entityId: commId,
      actionType: "COMMISSION_STATUS_CHANGED",
      previousValue: { status: "READY_FOR_PAYOUT" },
      newValue: { status: "PAID" },
    }).catch(console.error);
  }

  const updated = await db
    .select()
    .from(commissionsTable)
    .where(inArray(commissionsTable.id, numericIds));
  res.json(await enrich(updated));
});

export { enrich as enrichCommissions };
export default router;
