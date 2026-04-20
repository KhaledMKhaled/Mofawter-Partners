import { Router, type IRouter } from "express";
import {
  db,
  clientsTable,
  usersTable,
  clientAssignmentsTable,
} from "@workspace/db";
import { aliasedTable } from "drizzle-orm";
import { and, desc, eq } from "drizzle-orm";
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

router.patch("/:id/assignment", async (req, res) => {
  const { role, sub } = req.auth!;
  if (role !== "ADMIN" && role !== "DISTRIBUTOR") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const clientId = Number(req.params.id);
  if (!Number.isInteger(clientId)) {
    res.status(400).json({ error: "Invalid client id" });
    return;
  }
  const { assignedSalesId } = req.body ?? {};
  const newSalesId = Number(assignedSalesId);
  if (!Number.isInteger(newSalesId)) {
    res.status(400).json({ error: "assignedSalesId is required" });
    return;
  }

  const [client] = await db
    .select()
    .from(clientsTable)
    .where(eq(clientsTable.id, clientId));
  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }

  // Distributors may only reassign clients currently in their own team
  if (role === "DISTRIBUTOR" && client.assignedDistributorId !== sub) {
    res.status(403).json({ error: "Client does not belong to your team" });
    return;
  }

  const [newSales] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.id, newSalesId), eq(usersTable.role, "SALES")));
  if (!newSales || !newSales.distributorId) {
    res.status(400).json({ error: "Sales agent not found" });
    return;
  }

  // Distributors can only reassign to sales agents in their own team
  if (role === "DISTRIBUTOR" && newSales.distributorId !== sub) {
    res
      .status(403)
      .json({ error: "Sales agent does not belong to your team" });
    return;
  }

  if (
    client.assignedSalesId === newSalesId &&
    client.assignedDistributorId === newSales.distributorId
  ) {
    res.json(toDto(client));
    return;
  }

  const fromSalesId = client.assignedSalesId;
  const fromDistributorId = client.assignedDistributorId;
  const newDistributorId = newSales.distributorId;

  // Preserve original ownership window — only update assignment fields.
  // Update + audit insert run together so a failure in either rolls back both.
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(clientsTable)
      .set({
        assignedSalesId: newSalesId,
        assignedDistributorId: newDistributorId,
      })
      .where(eq(clientsTable.id, clientId))
      .returning();

    await tx.insert(clientAssignmentsTable).values({
      clientId,
      fromSalesId,
      fromDistributorId,
      toSalesId: newSalesId,
      toDistributorId: newDistributorId,
      changedById: sub,
    });

    return row;
  });

  res.json(toDto(updated));
});

router.get("/:id/assignments", async (req, res) => {
  const { role, sub } = req.auth!;
  const clientId = Number(req.params.id);
  if (!Number.isInteger(clientId)) {
    res.status(400).json({ error: "Invalid client id" });
    return;
  }

  const [client] = await db
    .select()
    .from(clientsTable)
    .where(eq(clientsTable.id, clientId));
  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }

  if (role === "DISTRIBUTOR" && client.assignedDistributorId !== sub) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (role === "SALES" && client.assignedSalesId !== sub) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const fromSales = aliasedTable(usersTable, "from_sales");
  const fromDist = aliasedTable(usersTable, "from_dist");
  const toSales = aliasedTable(usersTable, "to_sales");
  const toDist = aliasedTable(usersTable, "to_dist");
  const changedBy = aliasedTable(usersTable, "changed_by");

  const rows = await db
    .select({
      id: clientAssignmentsTable.id,
      clientId: clientAssignmentsTable.clientId,
      fromSalesId: clientAssignmentsTable.fromSalesId,
      fromSalesName: fromSales.name,
      fromDistributorId: clientAssignmentsTable.fromDistributorId,
      fromDistributorName: fromDist.name,
      toSalesId: clientAssignmentsTable.toSalesId,
      toSalesName: toSales.name,
      toDistributorId: clientAssignmentsTable.toDistributorId,
      toDistributorName: toDist.name,
      changedById: clientAssignmentsTable.changedById,
      changedByName: changedBy.name,
      createdAt: clientAssignmentsTable.createdAt,
    })
    .from(clientAssignmentsTable)
    .leftJoin(fromSales, eq(fromSales.id, clientAssignmentsTable.fromSalesId))
    .leftJoin(
      fromDist,
      eq(fromDist.id, clientAssignmentsTable.fromDistributorId),
    )
    .leftJoin(toSales, eq(toSales.id, clientAssignmentsTable.toSalesId))
    .leftJoin(toDist, eq(toDist.id, clientAssignmentsTable.toDistributorId))
    .leftJoin(
      changedBy,
      eq(changedBy.id, clientAssignmentsTable.changedById),
    )
    .where(eq(clientAssignmentsTable.clientId, clientId))
    .orderBy(desc(clientAssignmentsTable.createdAt));

  res.json(
    rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
  );
});

export default router;
