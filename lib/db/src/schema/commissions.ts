import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  numeric,
} from "drizzle-orm/pg-core";

export const COMMISSION_STATUSES = [
  "PENDING",
  "APPROVED",
  "READY_FOR_PAYOUT",
  "PAID",
  "CANCELLED",
] as const;
export type CommissionStatus = (typeof COMMISSION_STATUSES)[number];

export const COMMISSION_BENEFICIARY_TYPES = ["DISTRIBUTOR", "SALES"] as const;
export type CommissionBeneficiaryType = (typeof COMMISSION_BENEFICIARY_TYPES)[number];

export const COMMISSION_TYPES = [
  "NEW_SUBSCRIPTION",
  "RENEWAL",
  "UPGRADE",
  "ADD_ON",
] as const;
export type CommissionType = (typeof COMMISSION_TYPES)[number];

export const commissionsTable = pgTable("commissions", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  clientId: integer("client_id").notNull(),
  userId: integer("user_id").notNull(),
  // The raw order amount used as the commission base
  baseAmount: numeric("base_amount", { precision: 14, scale: 2 }).notNull(),
  // Calculated commission value
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  roleType: text("role_type", { enum: COMMISSION_BENEFICIARY_TYPES }).notNull(),
  commissionType: text("commission_type", { enum: COMMISSION_TYPES })
    .notNull()
    .default("NEW_SUBSCRIPTION"),
  // Which commission rule was applied (null = global settings fallback)
  appliedRuleId: integer("applied_rule_id"),
  // Payment batch this commission is assigned to (null = not yet batched)
  paymentBatchId: integer("payment_batch_id"),
  status: text("status", { enum: COMMISSION_STATUSES })
    .notNull()
    .default("PENDING"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  paidByUserId: integer("paid_by_user_id"),
});

export type Commission = typeof commissionsTable.$inferSelect;
