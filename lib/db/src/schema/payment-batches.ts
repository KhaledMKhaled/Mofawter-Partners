import {
  pgTable,
  text,
  serial,
  numeric,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";
import { COMMISSION_BENEFICIARY_TYPES, COMMISSION_TYPES } from "./commissions";

/**
 * Payment Delivery / Payout Batch system per BRD §16.1.
 * A single batch groups multiple commission transactions for the same beneficiary
 * and settles them in one payment operation.
 */

export const PAYMENT_BATCH_STATUSES = ["DRAFT", "CONFIRMED", "CANCELLED"] as const;
export type PaymentBatchStatus = (typeof PAYMENT_BATCH_STATUSES)[number];

export const paymentBatchesTable = pgTable("payment_batches", {
  id: serial("id").primaryKey(),
  // The beneficiary receiving this batch payment
  beneficiaryType: text("beneficiary_type", { enum: COMMISSION_BENEFICIARY_TYPES }).notNull(),
  beneficiaryId: integer("beneficiary_id").notNull(),
  beneficiaryName: text("beneficiary_name").notNull(),
  // Payment details
  paymentDate: timestamp("payment_date", { withTimezone: true }),
  paymentReference: text("payment_reference"),
  totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  paymentMethod: text("payment_method"),
  status: text("status", { enum: PAYMENT_BATCH_STATUSES }).notNull().default("DRAFT"),
  notes: text("notes"),
  // Audit
  createdById: integer("created_by_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type PaymentBatch = typeof paymentBatchesTable.$inferSelect;

/**
 * Individual commission items within a payment batch.
 * Created when commissions are added to a batch.
 */
export const paymentBatchItemsTable = pgTable("payment_batch_items", {
  id: serial("id").primaryKey(),
  batchId: integer("batch_id").notNull(),
  commissionId: integer("commission_id").notNull().unique(), // one commission → at most one batch
  clientId: integer("client_id").notNull(),
  orderId: integer("order_id").notNull(),
  commissionValue: numeric("commission_value", { precision: 14, scale: 2 }).notNull(),
  commissionType: text("commission_type", { enum: COMMISSION_TYPES }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type PaymentBatchItem = typeof paymentBatchItemsTable.$inferSelect;
