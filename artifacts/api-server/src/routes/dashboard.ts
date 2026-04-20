import { Router, type IRouter } from "express";
import {
  db,
  ordersTable,
  clientsTable,
  commissionsTable,
  usersTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/summary", async (req, res) => {
  const { role, sub } = req.auth!;

  // Determine relevant clients
  let clients: (typeof clientsTable.$inferSelect)[] = [];
  if (role === "ADMIN") {
    clients = await db.select().from(clientsTable);
  } else if (role === "DISTRIBUTOR") {
    clients = await db
      .select()
      .from(clientsTable)
      .where(eq(clientsTable.assignedDistributorId, sub));
  } else {
    clients = await db
      .select()
      .from(clientsTable)
      .where(eq(clientsTable.assignedSalesId, sub));
  }
  const clientIds = clients.map((c) => c.id);

  // Orders
  let orders: (typeof ordersTable.$inferSelect)[] = [];
  if (role === "ADMIN") {
    orders = await db
      .select()
      .from(ordersTable)
      .orderBy(desc(ordersTable.orderDate));
  } else if (clientIds.length > 0) {
    const all = await db
      .select()
      .from(ordersTable)
      .orderBy(desc(ordersTable.orderDate));
    orders = all.filter((o) => clientIds.includes(o.clientId));
  }

  // Commissions
  let commissions: (typeof commissionsTable.$inferSelect)[] = [];
  if (role === "ADMIN") {
    commissions = await db
      .select()
      .from(commissionsTable)
      .orderBy(desc(commissionsTable.createdAt));
  } else {
    commissions = await db
      .select()
      .from(commissionsTable)
      .where(eq(commissionsTable.userId, sub))
      .orderBy(desc(commissionsTable.createdAt));
  }

  const totalOrders = orders.length;
  const completedOrders = orders.filter((o) => o.status === "COMPLETED").length;
  const pendingOrders = totalOrders - completedOrders;
  const totalSales = orders
    .filter((o) => o.status === "COMPLETED")
    .reduce((s, o) => s + Number(o.amount), 0);
  const totalCommissions = commissions.reduce(
    (s, c) => s + Number(c.amount),
    0,
  );

  let teamSize: number | null = null;
  if (role === "DISTRIBUTOR") {
    const team = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.distributorId, sub));
    teamSize = team.length;
  } else if (role === "ADMIN") {
    const all = await db.select().from(usersTable);
    teamSize = all.length;
  }
  const clientCount = clients.length;

  // Build enriched recent orders/commissions (top 5 each)
  const recentOrdersRaw = orders.slice(0, 5);
  const recentCommissionsRaw = commissions.slice(0, 5);

  const clientMap = new Map(clients.map((c) => [c.id, c]));
  const allUsers = await db.select().from(usersTable);
  const userMap = new Map(allUsers.map((u) => [u.id, u]));
  // For ADMIN, also need clients referenced by orders that aren't in our list (they are; we fetched all)
  const recentOrders = recentOrdersRaw.map((o) => {
    const c = clientMap.get(o.clientId);
    const sales = c ? userMap.get(c.assignedSalesId) : undefined;
    const dist = c ? userMap.get(c.assignedDistributorId) : undefined;
    return {
      id: o.id,
      clientId: o.clientId,
      clientName: c?.name ?? null,
      salesId: c?.assignedSalesId ?? null,
      salesName: sales?.name ?? null,
      distributorId: c?.assignedDistributorId ?? null,
      distributorName: dist?.name ?? null,
      orderName: o.orderName,
      amount: Number(o.amount),
      orderDate: o.orderDate.toISOString(),
      status: o.status,
      createdAt: o.createdAt.toISOString(),
    };
  });

  // Build orderId -> order map for commissions enrichment
  const allOrders =
    role === "ADMIN"
      ? orders
      : await db.select().from(ordersTable);
  const orderMap = new Map(allOrders.map((o) => [o.id, o]));
  // also need full client map for admin
  const allClients =
    role === "ADMIN"
      ? clients
      : await db.select().from(clientsTable);
  const fullClientMap = new Map(allClients.map((c) => [c.id, c]));

  const recentCommissions = recentCommissionsRaw.map((cm) => {
    const order = orderMap.get(cm.orderId);
    const client = order ? fullClientMap.get(order.clientId) : undefined;
    const user = userMap.get(cm.userId);
    return {
      id: cm.id,
      orderId: cm.orderId,
      orderName: order?.orderName ?? null,
      clientName: client?.name ?? null,
      userId: cm.userId,
      userName: user?.name ?? null,
      amount: Number(cm.amount),
      roleType: cm.roleType,
      status: cm.status,
      createdAt: cm.createdAt.toISOString(),
    };
  });

  res.json({
    role,
    totalOrders,
    completedOrders,
    pendingOrders,
    totalSales,
    totalCommissions,
    teamSize,
    clientCount,
    recentOrders,
    recentCommissions,
  });
});

export default router;
