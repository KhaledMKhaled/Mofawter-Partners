import { Router } from "express";
import { eq, inArray, desc, and, sql } from "drizzle-orm";
import {
  db,
  paymentBatchesTable,
  paymentBatchItemsTable,
  commissionsTable,
  usersTable,
  clientsTable,
  ordersTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";
import { logAudit } from "../lib/audit";

const router = Router();
router.use(requireAuth);
// Only Admin and Operations can manage payment batches
router.use(requireRole("ADMIN", "OPERATIONS"));

// ============================================================================
// GET /payment-batches — list batches with filters
// ============================================================================
router.get("/", async (req, res, next) => {
  try {
    const { beneficiaryId, status } = req.query;
    let query = db.select().from(paymentBatchesTable);

    const batches = await db
      .select()
      .from(paymentBatchesTable)
      .orderBy(desc(paymentBatchesTable.createdAt));

    const filtered = batches.filter((b) => {
      if (beneficiaryId && b.beneficiaryId !== Number(beneficiaryId)) return false;
      if (status && b.status !== status) return false;
      return true;
    });

    // For each batch, count included commissions and clients
    const batchIds = filtered.map((b) => b.id);
    let itemCounts: Map<number, { commissionCount: number; clientCount: number }> = new Map();
    if (batchIds.length > 0) {
      const items = await db
        .select()
        .from(paymentBatchItemsTable)
        .where(inArray(paymentBatchItemsTable.batchId, batchIds));
      for (const batchId of batchIds) {
        const batchItems = items.filter((i) => i.batchId === batchId);
        const uniqueClients = new Set(batchItems.map((i) => i.clientId));
        itemCounts.set(batchId, {
          commissionCount: batchItems.length,
          clientCount: uniqueClients.size,
        });
      }
    }

    res.json(
      filtered.map((b) => ({
        ...b,
        totalAmount: Number(b.totalAmount),
        paymentDate: b.paymentDate ? b.paymentDate.toISOString() : null,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
        commissionCount: itemCounts.get(b.id)?.commissionCount ?? 0,
        clientCount: itemCounts.get(b.id)?.clientCount ?? 0,
      })),
    );
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET /payment-batches/:id — get batch detail with items
// ============================================================================
router.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [batch] = await db
      .select()
      .from(paymentBatchesTable)
      .where(eq(paymentBatchesTable.id, id));
    if (!batch) {
      res.status(404).json({ error: "Payment batch not found" });
      return;
    }

    const items = await db
      .select()
      .from(paymentBatchItemsTable)
      .where(eq(paymentBatchItemsTable.batchId, id));

    // Enrich items with client and order names
    const clientIds = [...new Set(items.map((i) => i.clientId))];
    const orderIds = [...new Set(items.map((i) => i.orderId))];
    const commissionIds = items.map((i) => i.commissionId);

    const [clients, orders, commissions] = await Promise.all([
      clientIds.length > 0
        ? db.select().from(clientsTable).where(inArray(clientsTable.id, clientIds))
        : Promise.resolve([]),
      orderIds.length > 0
        ? db.select().from(ordersTable).where(inArray(ordersTable.id, orderIds))
        : Promise.resolve([]),
      commissionIds.length > 0
        ? db.select().from(commissionsTable).where(inArray(commissionsTable.id, commissionIds))
        : Promise.resolve([]),
    ]);

    const clientMap = new Map(clients.map((c) => [c.id, c]));
    const orderMap = new Map(orders.map((o) => [o.id, o]));
    const commissionMap = new Map(commissions.map((c) => [c.id, c]));

    const enrichedItems = items.map((item) => ({
      id: item.id,
      batchId: item.batchId,
      commissionId: item.commissionId,
      commissionStatus: commissionMap.get(item.commissionId)?.status ?? null,
      clientId: item.clientId,
      clientName: clientMap.get(item.clientId)?.name ?? null,
      taxCardNumber: clientMap.get(item.clientId)?.taxCardNumber ?? null,
      orderId: item.orderId,
      orderName: orderMap.get(item.orderId)?.orderName ?? null,
      commissionValue: Number(item.commissionValue),
      commissionType: item.commissionType,
      createdAt: item.createdAt.toISOString(),
    }));

    res.json({
      ...batch,
      totalAmount: Number(batch.totalAmount),
      paymentDate: batch.paymentDate ? batch.paymentDate.toISOString() : null,
      createdAt: batch.createdAt.toISOString(),
      updatedAt: batch.updatedAt.toISOString(),
      items: enrichedItems,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// POST /payment-batches — create a draft batch from selected commissions
// ============================================================================
router.post("/", async (req, res, next) => {
  try {
    const { sub, role } = req.auth!;
    const { commissionIds, notes } = req.body ?? {};

    if (!Array.isArray(commissionIds) || commissionIds.length === 0) {
      res.status(400).json({ error: "commissionIds must be a non-empty array" });
      return;
    }

    const numericIds = commissionIds.map(Number).filter(Number.isFinite);
    if (numericIds.length === 0) {
      res.status(400).json({ error: "commissionIds must contain valid integers" });
      return;
    }

    // Fetch selected commissions
    const selectedCommissions = await db
      .select()
      .from(commissionsTable)
      .where(inArray(commissionsTable.id, numericIds));

    if (selectedCommissions.length !== numericIds.length) {
      res.status(400).json({ error: "One or more commission IDs not found" });
      return;
    }

    // Business rule: all must be same beneficiary
    const beneficiaryIds = [...new Set(selectedCommissions.map((c) => c.userId))];
    if (beneficiaryIds.length > 1) {
      res.status(400).json({ error: "All commissions in a batch must belong to the same beneficiary" });
      return;
    }

    // Business rule: all must be in READY_FOR_PAYOUT status
    const notReady = selectedCommissions.filter((c) => c.status !== "READY_FOR_PAYOUT");
    if (notReady.length > 0) {
      res.status(400).json({
        error: "All commissions must be in READY_FOR_PAYOUT status",
        invalidIds: notReady.map((c) => c.id),
      });
      return;
    }

    // Business rule: none can already be in a batch
    const alreadyBatched = selectedCommissions.filter((c) => c.paymentBatchId != null);
    if (alreadyBatched.length > 0) {
      res.status(400).json({
        error: "Some commissions are already assigned to a payment batch",
        conflictIds: alreadyBatched.map((c) => c.id),
      });
      return;
    }

    const beneficiaryId = beneficiaryIds[0];
    const [beneficiary] = await db.select().from(usersTable).where(eq(usersTable.id, beneficiaryId));
    if (!beneficiary) {
      res.status(400).json({ error: "Beneficiary user not found" });
      return;
    }

    const totalAmount = selectedCommissions.reduce((sum, c) => sum + Number(c.amount), 0);
    const beneficiaryType = selectedCommissions[0].roleType;

    const result = await db.transaction(async (tx) => {
      // Create the batch
      const [batch] = await tx
        .insert(paymentBatchesTable)
        .values({
          beneficiaryType,
          beneficiaryId,
          beneficiaryName: beneficiary.name,
          totalAmount: totalAmount.toFixed(2),
          status: "DRAFT",
          notes: notes ?? null,
          createdById: sub,
        })
        .returning();

      // Create batch items
      const items = selectedCommissions.map((c) => ({
        batchId: batch.id,
        commissionId: c.id,
        clientId: c.clientId,
        orderId: c.orderId,
        commissionValue: c.amount,
        commissionType: c.commissionType,
      }));
      await tx.insert(paymentBatchItemsTable).values(items);

      // Link commissions to this batch
      await tx
        .update(commissionsTable)
        .set({ paymentBatchId: batch.id, updatedAt: new Date() })
        .where(inArray(commissionsTable.id, numericIds));

      return batch;
    });

    const [userRow] = await db.select().from(usersTable).where(eq(usersTable.id, sub));
    await logAudit({
      ctx: { userId: sub, userName: userRow?.name ?? "Unknown", userRole: role! },
      entityType: "payment_batch",
      entityId: result.id,
      actionType: "PAYMENT_BATCH_CREATED",
      newValue: { beneficiaryId, beneficiaryType, totalAmount, commissionCount: numericIds.length },
    });

    res.status(201).json({ ...result, totalAmount: Number(result.totalAmount) });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// POST /payment-batches/:id/confirm — confirm batch and mark commissions as PAID
// ============================================================================
router.post("/:id/confirm", async (req, res, next) => {
  try {
    const { sub, role } = req.auth!;
    const id = Number(req.params.id);
    const { paymentDate, paymentReference, paymentMethod } = req.body ?? {};

    const [batch] = await db
      .select()
      .from(paymentBatchesTable)
      .where(eq(paymentBatchesTable.id, id));
    if (!batch) {
      res.status(404).json({ error: "Payment batch not found" });
      return;
    }
    if (batch.status !== "DRAFT") {
      res.status(400).json({ error: `Cannot confirm a batch in ${batch.status} status` });
      return;
    }

    const items = await db
      .select()
      .from(paymentBatchItemsTable)
      .where(eq(paymentBatchItemsTable.batchId, id));

    const commissionIds = items.map((i) => i.commissionId);
    const paidAt = paymentDate ? new Date(paymentDate) : new Date();

    await db.transaction(async (tx) => {
      // Update batch to CONFIRMED
      await tx
        .update(paymentBatchesTable)
        .set({
          status: "CONFIRMED",
          paymentDate: paidAt,
          paymentReference: paymentReference ?? null,
          paymentMethod: paymentMethod ?? null,
          updatedAt: new Date(),
        })
        .where(eq(paymentBatchesTable.id, id));

      // Mark all commissions as PAID
      if (commissionIds.length > 0) {
        await tx
          .update(commissionsTable)
          .set({
            status: "PAID",
            paidAt,
            paidByUserId: sub,
            updatedAt: new Date(),
          })
          .where(inArray(commissionsTable.id, commissionIds));
      }
    });

    const [userRow] = await db.select().from(usersTable).where(eq(usersTable.id, sub));
    await logAudit({
      ctx: { userId: sub, userName: userRow?.name ?? "Unknown", userRole: role! },
      entityType: "payment_batch",
      entityId: id,
      actionType: "PAYMENT_BATCH_CONFIRMED",
      previousValue: { status: "DRAFT" },
      newValue: { status: "CONFIRMED", paymentReference, commissionsPaid: commissionIds.length },
    });

    const [updated] = await db
      .select()
      .from(paymentBatchesTable)
      .where(eq(paymentBatchesTable.id, id));
    res.json({ ...updated, totalAmount: Number(updated.totalAmount) });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// POST /payment-batches/:id/cancel — cancel a draft batch
// ============================================================================
router.post("/:id/cancel", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const { sub, role } = req.auth!;
    const id = Number(req.params.id);

    const [batch] = await db
      .select()
      .from(paymentBatchesTable)
      .where(eq(paymentBatchesTable.id, id));
    if (!batch) {
      res.status(404).json({ error: "Payment batch not found" });
      return;
    }
    if (batch.status === "CONFIRMED") {
      res.status(400).json({ error: "Cannot cancel a confirmed batch" });
      return;
    }

    const items = await db
      .select()
      .from(paymentBatchItemsTable)
      .where(eq(paymentBatchItemsTable.batchId, id));
    const commissionIds = items.map((i) => i.commissionId);

    await db.transaction(async (tx) => {
      await tx
        .update(paymentBatchesTable)
        .set({ status: "CANCELLED", updatedAt: new Date() })
        .where(eq(paymentBatchesTable.id, id));

      // Unlink commissions from this batch
      if (commissionIds.length > 0) {
        await tx
          .update(commissionsTable)
          .set({ paymentBatchId: null, updatedAt: new Date() })
          .where(inArray(commissionsTable.id, commissionIds));
      }
    });

    const [userRow] = await db.select().from(usersTable).where(eq(usersTable.id, sub));
    await logAudit({
      ctx: { userId: sub, userName: userRow?.name ?? "Unknown", userRole: role! },
      entityType: "payment_batch",
      entityId: id,
      actionType: "PAYMENT_BATCH_CANCELLED",
      previousValue: { status: batch.status },
      newValue: { status: "CANCELLED" },
    });

    res.json({ message: "Batch cancelled", batchId: id });
  } catch (err) {
    next(err);
  }
});

export default router;
