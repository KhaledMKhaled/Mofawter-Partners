import { Router, type IRouter } from "express";
import {
  db,
  commissionsTable,
  ordersTable,
  clientsTable,
  usersTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
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
};

async function enrich(
  rows: (typeof commissionsTable.$inferSelect)[],
): Promise<EnrichedCommission[]> {
  if (rows.length === 0) return [];
  const orderIds = [...new Set(rows.map((c) => c.orderId))];
  const userIds = [...new Set(rows.map((c) => c.userId))];
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

export { enrich as enrichCommissions };
export default router;
