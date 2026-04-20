import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";

export const clientsTable = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  assignedSalesId: integer("assigned_sales_id").notNull(),
  assignedDistributorId: integer("assigned_distributor_id").notNull(),
  ownershipStartDate: timestamp("ownership_start_date", { withTimezone: true })
    .notNull()
    .defaultNow(),
  ownershipEndDate: timestamp("ownership_end_date", { withTimezone: true })
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Client = typeof clientsTable.$inferSelect;

export const clientAssignmentsTable = pgTable("client_assignments", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  fromSalesId: integer("from_sales_id"),
  fromDistributorId: integer("from_distributor_id"),
  toSalesId: integer("to_sales_id").notNull(),
  toDistributorId: integer("to_distributor_id").notNull(),
  changedById: integer("changed_by_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ClientAssignment = typeof clientAssignmentsTable.$inferSelect;
