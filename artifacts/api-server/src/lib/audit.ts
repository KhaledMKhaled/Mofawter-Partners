import { db, auditLogsTable } from "@workspace/db";
import type { AuditActionType, AuditEntityType } from "@workspace/db";

export interface AuditContext {
  userId: number;
  userName: string;
  userRole: string;
}

export async function logAudit(params: {
  ctx: AuditContext;
  entityType: AuditEntityType;
  entityId: number;
  actionType: AuditActionType;
  previousValue?: unknown;
  newValue?: unknown;
  reason?: string;
}): Promise<void> {
  const { ctx, entityType, entityId, actionType, previousValue, newValue, reason } = params;

  await db.insert(auditLogsTable).values({
    entityType,
    entityId,
    actionType,
    userId: ctx.userId,
    userName: ctx.userName,
    userRole: ctx.userRole,
    previousValue: previousValue != null ? JSON.stringify(previousValue) : null,
    newValue: newValue != null ? JSON.stringify(newValue) : null,
    reason: reason ?? null,
  });
}
