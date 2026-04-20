import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";

/**
 * Audit trail for critical business actions per BRD §18.
 * Records every significant change with before/after values for full traceability.
 */

export const AUDIT_ACTION_TYPES = [
  // Client actions
  "CLIENT_CREATED",
  "CLIENT_UPDATED",
  "CLIENT_REASSIGNED",
  "CLIENT_OWNERSHIP_EXTENDED",
  "CLIENT_OWNERSHIP_OVERRIDDEN",
  // Order actions
  "ORDER_CREATED",
  "ORDER_STATUS_CHANGED",
  "ORDER_STATUS_ADMIN_OVERRIDE",  // Admin forced non-standard transition
  // Commission actions
  "COMMISSION_GENERATED",
  "COMMISSION_STATUS_CHANGED",
  "COMMISSION_CANCELLED",
  // Payment batch actions
  "PAYMENT_BATCH_CREATED",
  "PAYMENT_BATCH_CONFIRMED",
  "PAYMENT_BATCH_CANCELLED",
  // Config actions
  "COMMISSION_RULE_CREATED",
  "COMMISSION_RULE_UPDATED",
  "COMMISSION_RULE_DEACTIVATED",
  "PACKAGE_CREATED",
  "PACKAGE_UPDATED",
  "PACKAGE_DELETED",
  "SETTINGS_UPDATED",
  // User actions
  "USER_CREATED",
  "USER_UPDATED",
  "USER_DEACTIVATED",
] as const;
export type AuditActionType = (typeof AUDIT_ACTION_TYPES)[number];

export const AUDIT_ENTITY_TYPES = [
  "client",
  "order",
  "commission",
  "payment_batch",
  "commission_rule",
  "package",
  "settings",
  "user",
] as const;
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  entityType: text("entity_type", { enum: AUDIT_ENTITY_TYPES }).notNull(),
  entityId: integer("entity_id").notNull(),
  actionType: text("action_type", { enum: AUDIT_ACTION_TYPES }).notNull(),
  // Who performed the action
  userId: integer("user_id").notNull(),
  userName: text("user_name").notNull(),
  userRole: text("user_role").notNull(),
  // JSON snapshots: null if not applicable
  previousValue: text("previous_value"),  // JSON string
  newValue: text("new_value"),            // JSON string
  // Optional reason (e.g. admin override justification)
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type AuditLog = typeof auditLogsTable.$inferSelect;
