import { Router, type IRouter } from "express";
import {
  db,
  commissionsTable,
  ordersTable,
  clientsTable,
  usersTable,
} from "@workspace/db";
import { eq, desc, inArray, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();
router.use(requireAuth);

type EnrichedCommission = {
  id: number;
  orderId: number;
  orderName: string | null;
  clientName: string | null;
  userId: number;
  userName: string | null;
  amount: number;
  roleType: "SALES" | "DISTRIBUTOR";
  status: "UNPAID" | "PAID";
  createdAt: string;
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
  const clientIds = [...new Set(orders.map((o) => o.clientId))];
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

  return rows.map((c) => {
    const order = orderMap.get(c.orderId);
    const client = order ? clientMap.get(order.clientId) : undefined;
    const user = userMap.get(c.userId);
    const paidBy = c.paidByUserId ? userMap.get(c.paidByUserId) : undefined;
    return {
      id: c.id,
      orderId: c.orderId,
      orderName: order?.orderName ?? null,
      clientName: client?.name ?? null,
      userId: c.userId,
      userName: user?.name ?? null,
      amount: Number(c.amount),
      roleType: c.roleType,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
      paidAt: c.paidAt ? c.paidAt.toISOString() : null,
      paidByUserId: c.paidByUserId ?? null,
      paidByName: paidBy?.name ?? null,
    };
  });
}

router.get("/", async (req, res) => {
  const { role, sub } = req.auth!;
  let rows;
  if (role === "ADMIN") {
    rows = await db
      .select()
      .from(commissionsTable)
      .orderBy(desc(commissionsTable.createdAt));
  } else if (role === "DISTRIBUTOR") {
    // Distributor sees their own commissions PLUS those of every Sales agent on their team.
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

router.patch("/:id/status", async (req, res) => {
  const { role, sub } = req.auth!;
  if (role !== "ADMIN") {
    res.status(403).json({ error: "Only admins can update commission status" });
    return;
  }
  const id = Number(req.params.id);
  const { status } = req.body ?? {};
  if (!["UNPAID", "PAID"].includes(status)) {
    res.status(400).json({ error: "Invalid status" });
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
  if (status === "PAID" && existing.status !== "PAID") {
    await db
      .update(commissionsTable)
      .set({ status: "PAID", paidAt: new Date(), paidByUserId: sub })
      .where(eq(commissionsTable.id, id));
  } else if (status === "UNPAID" && existing.status !== "UNPAID") {
    await db
      .update(commissionsTable)
      .set({ status: "UNPAID", paidAt: null, paidByUserId: null })
      .where(eq(commissionsTable.id, id));
  }
  const [refreshed] = await db
    .select()
    .from(commissionsTable)
    .where(eq(commissionsTable.id, id));
  const [enriched] = await enrich([refreshed]);
  res.json(enriched);
});

router.post("/mark-paid", async (req, res) => {
  const { role, sub } = req.auth!;
  if (role !== "ADMIN") {
    res.status(403).json({ error: "Only admins can mark commissions paid" });
    return;
  }
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
    .set({ status: "PAID", paidAt: new Date(), paidByUserId: sub })
    .where(
      and(
        inArray(commissionsTable.id, numericIds),
        eq(commissionsTable.status, "UNPAID"),
      ),
    );
  const updated = await db
    .select()
    .from(commissionsTable)
    .where(inArray(commissionsTable.id, numericIds));
  res.json(await enrich(updated));
});

export { enrich as enrichCommissions };
export default router;
