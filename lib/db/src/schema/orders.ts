import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  numeric,
} from "drizzle-orm/pg-core";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  orderName: text("order_name").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  orderDate: timestamp("order_date", { withTimezone: true })
    .notNull()
    .defaultNow(),
  status: text("status", { enum: ["PENDING", "COMPLETED"] })
    .notNull()
    .default("PENDING"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Order = typeof ordersTable.$inferSelect;
