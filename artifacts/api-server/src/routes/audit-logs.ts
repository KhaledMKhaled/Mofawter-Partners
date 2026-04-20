import { Router } from "express";
import { desc, eq, and } from "drizzle-orm";
import { db, auditLogsTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);
// Only Admin and Operations can view audit logs
router.use(requireRole("ADMIN", "OPERATIONS"));

// ============================================================================
// GET /audit-logs — paginated audit trail with optional filters
// ============================================================================
router.get("/", async (req, res, next) => {
  try {
    const {
      entityType,
      actionType,
      userId,
      limit = "100",
      offset = "0",
    } = req.query as Record<string, string>;

    // Build filter conditions
    const conditions = [];
    if (entityType) conditions.push(eq(auditLogsTable.entityType, entityType as any));
    if (actionType) conditions.push(eq(auditLogsTable.actionType, actionType as any));
    if (userId) conditions.push(eq(auditLogsTable.userId, Number(userId)));

    const query = db
      .select()
      .from(auditLogsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(Math.min(Number(limit), 500))
      .offset(Number(offset));

    const logs = await query;

    res.json(
      logs.map((log) => ({
        id: log.id,
        entityType: log.entityType,
        entityId: log.entityId,
        actionType: log.actionType,
        userId: log.userId,
        userName: log.userName,
        userRole: log.userRole,
        previousValue: log.previousValue,
        newValue: log.newValue,
        reason: log.reason,
        createdAt: log.createdAt.toISOString(),
      })),
    );
  } catch (err) {
    next(err);
  }
});

export default router;
