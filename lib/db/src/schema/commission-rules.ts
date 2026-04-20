import {
  pgTable,
  text,
  serial,
  numeric,
  boolean,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";
import { COMMISSION_BENEFICIARY_TYPES, COMMISSION_TYPES } from "./commissions";

/**
 * Configurable commission rules per BRD §15.3.
 * Rules can be scoped to a specific package & event type, or left general.
 * The engine picks the most specific rule that matches; falls back to global settings.
 *
 * Priority (highest to lowest):
 *   1. packageId + eventType match
 *   2. eventType match only (packageId IS NULL)
 *   3. Global settings (sales_commission_pct / distributor_commission_pct)
 */
export const commissionRulesTable = pgTable("commission_rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  // Null = applies to all packages of this event type
  packageId: integer("package_id"),
  eventType: text("event_type", { enum: COMMISSION_TYPES }).notNull(),
  beneficiaryType: text("beneficiary_type", { enum: COMMISSION_BENEFICIARY_TYPES }).notNull(),
  percentage: numeric("percentage", { precision: 5, scale: 2 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type CommissionRule = typeof commissionRulesTable.$inferSelect;
