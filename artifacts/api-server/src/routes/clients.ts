import { Router, type IRouter } from "express";
import {
  db,
  clientsTable,
  usersTable,
  ordersTable,
  commissionsTable,
  clientAssignmentsTable,
} from "@workspace/db";
import { aliasedTable } from "drizzle-orm";
import { and, desc, eq, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();
router.use(requireAuth);

const TAX_CARD_DIGITS_ONLY_REGEX = /^\d+$/;
const TAX_CARD_DIGITS_ONLY_ERROR = "taxCardNumber must contain digits only";

function normalizeTaxCardNumber(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, "");
}

function isValidTaxCardNumber(value: string): boolean {
  return TAX_CARD_DIGITS_ONLY_REGEX.test(value);
}

function addFiveYears(start: Date): Date {
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + 5);
  return end;
}

function toDto(c: typeof clientsTable.$inferSelect) {
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
    createdAt: c.createdAt.toISOString(),
  };
}

type FinancialTimelineEventType =
  | "ORDER_CREATED"
  | "ORDER_STATUS_CHANGED"
  | "COMMISSION_GENERATED"
  | "COMMISSION_PAID";

router.get("/lookup", async (req, res, next) => {
  try {
    const taxCardNumber = normalizeTaxCardNumber(req.query.taxCardNumber);
    if (!taxCardNumber) {
      res.status(400).json({ error: "taxCardNumber is required" });;
      return;
    }

    if (!isValidTaxCardNumber(taxCardNumber)) {
      res.status(400).json({ error: TAX_CARD_DIGITS_ONLY_ERROR });
      return;
    }

    const [client] = await db
      .select()
      .from(clientsTable)
      .where(eq(clientsTable.taxCardNumber, taxCardNumber));

    if (!client) {
      res.json({ found: false });;
      return;
    }

    const [pendingOrder] = await db
      .select()
      .from(ordersTable)
      .where(and(eq(ordersTable.clientId, client.id), eq(ordersTable.status, "PENDING")))
      .limit(1);

    res.json({
      found: true,
      client: toDto(client),
      hasPendingOrder: !!pendingOrder,
    });
  } catch (err) {
    next(err);
  }
});

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

router.post("/", async (req, res, next) => {
  try {
    const { role, sub } = req.auth!;
    const {
      name, assignedSalesId,
      taxCardNumber: rawTaxCardNumber, taxCardName, issuingAuthority,
      commercialRegistryNumber, businessType, email,
      phone1, phone1WhatsApp, phone2, phone2WhatsApp,
      nationalId, address
    } = req.body ?? {};

    const taxCardNumber = normalizeTaxCardNumber(rawTaxCardNumber);

    if (!name || !taxCardNumber) {
      res.status(400).json({ error: "Name and taxCardNumber are required" });;
      return;
    }

    if (!isValidTaxCardNumber(taxCardNumber)) {
      res.status(400).json({ error: TAX_CARD_DIGITS_ONLY_ERROR });
      return;
    }

    let salesId: number;
    if (role === "SALES") {
      salesId = sub;
    } else if (role === "DISTRIBUTOR" || role === "ADMIN") {
      if (!assignedSalesId) {
        res.status(400).json({ error: "assignedSalesId is required" });;
      return;
      }
      salesId = Number(assignedSalesId);
    } else {
      res.status(403).json({ error: "Forbidden" });;
      return;
    }

    // Look up sales agent to grab their distributor
    const [sales] = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.id, salesId), eq(usersTable.role, "SALES")));
    if (!sales || !sales.distributorId) {
      res.status(400).json({ error: "Sales agent not found" });;
      return;
    }
    if (role === "DISTRIBUTOR" && sales.distributorId !== sub) {
      res.status(403).json({ error: "Sales agent does not belong to your team" });;
      return;
    }

    const start = new Date();
    const end = addFiveYears(start);
    try {
      const [created] = await db
        .insert(clientsTable)
        .values({
          name,
          taxCardNumber,
          taxCardName,
          issuingAuthority,
          commercialRegistryNumber,
          businessType,
          email,
          phone1,
          phone1WhatsApp: phone1WhatsApp || false,
          phone2: phone2 || null,
          phone2WhatsApp: phone2WhatsApp || false,
          nationalId,
          address,
          assignedSalesId: salesId,
          assignedDistributorId: sales.distributorId,
          ownershipStartDate: start,
          ownershipEndDate: end,
        })
        .returning();
      res.status(201).json(toDto(created));
    } catch (e: any) {
      if (e.code === '23505') { // Postgres unique_violation
        res.status(400).json({ error: "Tax card number already exists" });;
      return;
      }
      throw e;
    }
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const { role, sub } = req.auth!;
    const clientId = Number(req.params.id);
    if (!Number.isInteger(clientId)) {
      res.status(400).json({ error: "Invalid client id" });;
      return;
    }

    const [client] = await db
      .select()
      .from(clientsTable)
      .where(eq(clientsTable.id, clientId));

    if (!client) {
      res.status(404).json({ error: "Client not found" });;
      return;
    }

    if (role === "DISTRIBUTOR" && client.assignedDistributorId !== sub) {
      res.status(403).json({ error: "Forbidden" });;
      return;
    }
    if (role === "SALES" && client.assignedSalesId !== sub) {
      res.status(403).json({ error: "Forbidden" });;
      return;
    }

    const orders = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.clientId, clientId))
      .orderBy(desc(ordersTable.createdAt));

    const orderIds = orders.map((o) => o.id);
    const allCommissions = (
      orderIds.length > 0
        ? await db
            .select()
            .from(commissionsTable)
            .where(inArray(commissionsTable.orderId, orderIds))
        : []
    ).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );

    const financials = {
      subtotal: orders.reduce((sum, o) => sum + Number(o.amount), 0),
      vatTotal: orders.reduce((sum, o) => sum + Number(o.vatAmount), 0),
      collectedTotal: orders
        .filter((o) => o.isFullyCollected)
        .reduce((sum, o) => sum + Number(o.amount) + Number(o.vatAmount), 0),
      outstandingTotal: orders
        .filter((o) => !o.isFullyCollected)
        .reduce((sum, o) => sum + Number(o.amount) + Number(o.vatAmount), 0),
    };

    const timeline: Array<{
      type: FinancialTimelineEventType;
      occurredAt: string;
      orderId: number | null;
      orderName: string | null;
      commissionId: number | null;
      commissionStatus: "UNPAID" | "PAID" | null;
      amount: number | null;
      details: string;
    }> = [];

    for (const o of orders) {
      timeline.push({
        type: "ORDER_CREATED",
        occurredAt: o.createdAt.toISOString(),
        orderId: o.id,
        orderName: o.orderName,
        commissionId: null,
        commissionStatus: null,
        amount: Number(o.amount) + Number(o.vatAmount),
        details: `Order created (${o.status})`,
      });

      if (o.status !== "PENDING") {
        timeline.push({
          type: "ORDER_STATUS_CHANGED",
          occurredAt: o.orderDate.toISOString(),
          orderId: o.id,
          orderName: o.orderName,
          commissionId: null,
          commissionStatus: null,
          amount: Number(o.amount) + Number(o.vatAmount),
          details: `Order marked ${o.status}`,
        });
      }
    }

    for (const c of allCommissions) {
      timeline.push({
        type: "COMMISSION_GENERATED",
        occurredAt: c.createdAt.toISOString(),
        orderId: c.orderId,
        orderName: orders.find((o) => o.id === c.orderId)?.orderName ?? null,
        commissionId: c.id,
        commissionStatus: c.status,
        amount: Number(c.amount),
        details: `Commission created (${c.roleType})`,
      });

      if (c.paidAt) {
        timeline.push({
          type: "COMMISSION_PAID",
          occurredAt: c.paidAt.toISOString(),
          orderId: c.orderId,
          orderName: orders.find((o) => o.id === c.orderId)?.orderName ?? null,
          commissionId: c.id,
          commissionStatus: c.status,
          amount: Number(c.amount),
          details: "Commission paid",
        });
      }
    }

    res.json({
      client: toDto(client),
      orders: orders.map(o => ({
        ...o,
        orderDate: o.orderDate.toISOString(),
        createdAt: o.createdAt.toISOString(),
      })),
      commissions: allCommissions.map((c) => ({
        ...c,
        amount: Number(c.amount),
        createdAt: c.createdAt.toISOString(),
        paidAt: c.paidAt ? c.paidAt.toISOString() : null,
      })),
      financials,
      timeline: timeline.sort(
        (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
      ),
    });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const { role, sub } = req.auth!;
    const clientId = Number(req.params.id);
    if (!Number.isInteger(clientId)) {
      res.status(400).json({ error: "Invalid client id" });;
      return;
    }

    const [client] = await db
      .select()
      .from(clientsTable)
      .where(eq(clientsTable.id, clientId));

    if (!client) {
      res.status(404).json({ error: "Client not found" });;
      return;
    }

    if (role === "DISTRIBUTOR" && client.assignedDistributorId !== sub) {
      res.status(403).json({ error: "Forbidden" });;
      return;
    }
    if (role === "SALES" && client.assignedSalesId !== sub) {
      res.status(403).json({ error: "Forbidden" });;
      return;
    }

    const updates = req.body;
    // Don't allow changing assignments or ownership via generic patch
    delete updates.assignedSalesId;
    delete updates.assignedDistributorId;
    delete updates.ownershipStartDate;
    delete updates.ownershipEndDate;
    delete updates.id;
    delete updates.createdAt;

    try {
      const [updated] = await db
        .update(clientsTable)
        .set(updates)
        .where(eq(clientsTable.id, clientId))
        .returning();

      res.json(toDto(updated));
    } catch (e: any) {
      if (e.code === '23505') {
        res.status(400).json({ error: "Tax card number already exists" });;
      return;
      }
      throw e;
    }
  } catch (err) {
    next(err);
  }
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
