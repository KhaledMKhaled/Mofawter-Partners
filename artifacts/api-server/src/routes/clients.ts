import { Router, type IRouter } from "express";
import { db, clientsTable, usersTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();
router.use(requireAuth);

function addFiveYears(start: Date): Date {
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + 5);
  return end;
}

function toDto(c: typeof clientsTable.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    assignedSalesId: c.assignedSalesId,
    assignedDistributorId: c.assignedDistributorId,
    ownershipStartDate: c.ownershipStartDate.toISOString(),
    ownershipEndDate: c.ownershipEndDate.toISOString(),
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/", async (req, res) => {
  const { role, sub } = req.auth!;
  let rows;
  if (role === "ADMIN") {
    rows = await db.select().from(clientsTable);
  } else if (role === "DISTRIBUTOR") {
    rows = await db
      .select()
      .from(clientsTable)
      .where(eq(clientsTable.assignedDistributorId, sub));
  } else {
    rows = await db
      .select()
      .from(clientsTable)
      .where(eq(clientsTable.assignedSalesId, sub));
  }
  res.json(rows.map(toDto));
});

router.post("/", async (req, res) => {
  const { role, sub } = req.auth!;
  const { name, assignedSalesId } = req.body ?? {};
  if (!name) {
    res.status(400).json({ error: "Name is required" });
    return;
  }
  let salesId: number;
  if (role === "SALES") {
    salesId = sub;
  } else if (role === "DISTRIBUTOR" || role === "ADMIN") {
    if (!assignedSalesId) {
      res.status(400).json({ error: "assignedSalesId is required" });
      return;
    }
    salesId = Number(assignedSalesId);
  } else {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  // Look up sales agent to grab their distributor
  const [sales] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.id, salesId), eq(usersTable.role, "SALES")));
  if (!sales || !sales.distributorId) {
    res.status(400).json({ error: "Sales agent not found" });
    return;
  }
  if (role === "DISTRIBUTOR" && sales.distributorId !== sub) {
    res
      .status(403)
      .json({ error: "Sales agent does not belong to your team" });
    return;
  }
  const start = new Date();
  const end = addFiveYears(start);
  const [created] = await db
    .insert(clientsTable)
    .values({
      name,
      assignedSalesId: salesId,
      assignedDistributorId: sales.distributorId,
      ownershipStartDate: start,
      ownershipEndDate: end,
    })
    .returning();
  res.status(201).json(toDto(created));
});

export default router;
