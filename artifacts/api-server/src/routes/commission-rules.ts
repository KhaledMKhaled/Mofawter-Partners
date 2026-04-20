import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, commissionRulesTable, usersTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";
import { logAudit } from "../lib/audit";

const router = Router();
router.use(requireAuth);

// ============================================================================
// GET /commission-rules — list all rules (Admin/Operations read access)
// ============================================================================
router.get("/", async (req, res, next) => {
  try {
    const rules = await db
      .select()
      .from(commissionRulesTable)
      .orderBy(desc(commissionRulesTable.createdAt));
    res.json(rules.map((r) => ({
      ...r,
      percentage: Number(r.percentage),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })));
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// POST /commission-rules — create a new rule (Admin only)
// ============================================================================
router.post("/", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const { name, description, packageId, eventType, beneficiaryType, percentage } = req.body ?? {};
    const { sub } = req.auth!;

    if (!name || !eventType || !beneficiaryType || percentage === undefined) {
      res.status(400).json({ error: "Missing required fields: name, eventType, beneficiaryType, percentage" });
      return;
    }

    const validEventTypes = ["NEW_SUBSCRIPTION", "RENEWAL", "UPGRADE", "ADD_ON"];
    if (!validEventTypes.includes(eventType)) {
      res.status(400).json({ error: "Invalid eventType" });
      return;
    }

    const pct = Number(percentage);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      res.status(400).json({ error: "percentage must be between 0 and 100" });
      return;
    }

    const [created] = await db
      .insert(commissionRulesTable)
      .values({
        name,
        description: description ?? null,
        packageId: packageId ? Number(packageId) : null,
        eventType,
        beneficiaryType,
        percentage: pct.toString(),
        isActive: true,
      })
      .returning();

    const [userRow] = await db.select().from(usersTable).where(eq(usersTable.id, sub));
    await logAudit({
      ctx: { userId: sub, userName: userRow?.name ?? "Unknown", userRole: "ADMIN" },
      entityType: "commission_rule",
      entityId: created.id,
      actionType: "COMMISSION_RULE_CREATED",
      newValue: { name, eventType, beneficiaryType, percentage: pct, packageId },
    });

    res.status(201).json({ ...created, percentage: Number(created.percentage) });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// PATCH /commission-rules/:id — update a rule (Admin only)
// ============================================================================
router.patch("/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { sub } = req.auth!;
    const { name, description, packageId, eventType, beneficiaryType, percentage, isActive } = req.body;

    const [existing] = await db
      .select()
      .from(commissionRulesTable)
      .where(eq(commissionRulesTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "Commission rule not found" });
      return;
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (packageId !== undefined) updates.packageId = packageId ? Number(packageId) : null;
    if (eventType !== undefined) updates.eventType = eventType;
    if (beneficiaryType !== undefined) updates.beneficiaryType = beneficiaryType;
    if (percentage !== undefined) updates.percentage = Number(percentage).toString();
    if (isActive !== undefined) updates.isActive = isActive;

    const [updated] = await db
      .update(commissionRulesTable)
      .set(updates as any)
      .where(eq(commissionRulesTable.id, id))
      .returning();

    const [userRow] = await db.select().from(usersTable).where(eq(usersTable.id, sub));
    await logAudit({
      ctx: { userId: sub, userName: userRow?.name ?? "Unknown", userRole: "ADMIN" },
      entityType: "commission_rule",
      entityId: id,
      actionType: isActive === false ? "COMMISSION_RULE_DEACTIVATED" : "COMMISSION_RULE_UPDATED",
      previousValue: { ...existing, percentage: Number(existing.percentage) },
      newValue: { ...updated, percentage: Number(updated.percentage) },
    });

    res.json({ ...updated, percentage: Number(updated.percentage) });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// DELETE /commission-rules/:id — deactivate a rule (Admin only, soft delete)
// ============================================================================
router.delete("/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { sub } = req.auth!;

    const [existing] = await db
      .select()
      .from(commissionRulesTable)
      .where(eq(commissionRulesTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "Commission rule not found" });
      return;
    }

    await db
      .update(commissionRulesTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(commissionRulesTable.id, id));

    const [userRow] = await db.select().from(usersTable).where(eq(usersTable.id, sub));
    await logAudit({
      ctx: { userId: sub, userName: userRow?.name ?? "Unknown", userRole: "ADMIN" },
      entityType: "commission_rule",
      entityId: id,
      actionType: "COMMISSION_RULE_DEACTIVATED",
      previousValue: { isActive: true },
      newValue: { isActive: false },
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
