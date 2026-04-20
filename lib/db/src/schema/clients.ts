import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  boolean,
} from "drizzle-orm/pg-core";

export const OWNERSHIP_RULE_TYPES = ["FIXED", "RENEWABLE", "MANUAL_OVERRIDE"] as const;
export type OwnershipRuleType = (typeof OWNERSHIP_RULE_TYPES)[number];

export const OWNERSHIP_STATUSES = ["ACTIVE", "EXPIRED", "OVERRIDDEN"] as const;
export type OwnershipStatus = (typeof OWNERSHIP_STATUSES)[number];

export const clientsTable = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  taxCardNumber: text("tax_card_number").unique().notNull(),
  taxCardName: text("tax_card_name").notNull(),
  issuingAuthority: text("issuing_authority").notNull(),
  commercialRegistryNumber: text("commercial_registry_number").notNull(),
  businessType: text("business_type").notNull(),
  email: text("email").notNull(),
  phone1: text("phone1").notNull(),
  phone1WhatsApp: boolean("phone1_whatsapp").notNull().default(false),
  phone2: text("phone2"),
  phone2WhatsApp: boolean("phone2_whatsapp").notNull().default(false),
  nationalId: text("national_id").notNull(),
  address: text("address").notNull(),
  assignedSalesId: integer("assigned_sales_id").notNull(),
  assignedDistributorId: integer("assigned_distributor_id").notNull(),
  ownershipStartDate: timestamp("ownership_start_date", { withTimezone: true })
    .notNull()
    .defaultNow(),
  ownershipEndDate: timestamp("ownership_end_date", { withTimezone: true })
    .notNull(),
  ownershipRuleType: text("ownership_rule_type", { enum: OWNERSHIP_RULE_TYPES })
    .notNull()
    .default("FIXED"),
  ownershipStatus: text("ownership_status", { enum: OWNERSHIP_STATUSES })
    .notNull()
    .default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
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
