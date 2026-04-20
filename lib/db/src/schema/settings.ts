import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const settingsTable = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const SETTING_SALES_PCT = "sales_commission_pct";
export const SETTING_DIST_PCT = "distributor_commission_pct";

export type Setting = typeof settingsTable.$inferSelect;
