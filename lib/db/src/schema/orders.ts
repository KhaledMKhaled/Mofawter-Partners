import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  numeric,
  boolean,
} from "drizzle-orm/pg-core";

export const ORDER_STATUSES = [
  "NEW",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "IN_EXECUTION",
  "EXECUTED",
  "COLLECTED",
  "COMMISSION_PENDING",
  "COMMISSION_READY",
  "COMMISSION_PAID",
  "CANCELLED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_TYPES = [
  "NEW_SUBSCRIPTION",
  "RENEWAL",
  "UPGRADE",
  "ADD_ON",
] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

// Strict forward-only transitions for normal users.
// Admin may override, but will be audit-logged.
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ["UNDER_REVIEW", "CANCELLED"],
  UNDER_REVIEW: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["IN_EXECUTION", "CANCELLED"],
  REJECTED: [],                             // terminal — no forward path
  IN_EXECUTION: ["EXECUTED", "CANCELLED"],
  EXECUTED: ["COLLECTED", "CANCELLED"],
  COLLECTED: ["COMMISSION_PENDING"],
  COMMISSION_PENDING: ["COMMISSION_READY"],
  COMMISSION_READY: ["COMMISSION_PAID"],
  COMMISSION_PAID: [],                      // terminal
  CANCELLED: [],                            // terminal
};

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  packageId: integer("package_id"),
  orderName: text("order_name").notNull(),
  orderType: text("order_type", { enum: ORDER_TYPES })
    .notNull()
    .default("NEW_SUBSCRIPTION"),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  vatAmount: numeric("vat_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  receiptNumber: text("receipt_number"),
  isFullyCollected: boolean("is_fully_collected").notNull().default(false),
  orderDate: timestamp("order_date", { withTimezone: true })
    .notNull()
    .defaultNow(),
  status: text("status", { enum: ORDER_STATUSES })
    .notNull()
    .default("NEW"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Order = typeof ordersTable.$inferSelect;
