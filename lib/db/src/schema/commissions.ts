import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  numeric,
} from "drizzle-orm/pg-core";

export const commissionsTable = pgTable("commissions", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  userId: integer("user_id").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  roleType: text("role_type", { enum: ["DISTRIBUTOR", "SALES"] }).notNull(),
  status: text("status", { enum: ["UNPAID", "PAID"] })
    .notNull()
    .default("UNPAID"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Commission = typeof commissionsTable.$inferSelect;
