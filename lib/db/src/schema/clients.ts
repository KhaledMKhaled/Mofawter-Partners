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
