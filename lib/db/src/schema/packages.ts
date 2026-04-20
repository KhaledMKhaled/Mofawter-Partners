import {
  pgTable,
  text,
  serial,
  numeric,
  boolean,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";

export const packagesTable = pgTable("packages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  price: numeric("price", { precision: 14, scale: 2 }).notNull(),
  vatPct: numeric("vat_pct", { precision: 5, scale: 2 }).notNull().default("14"),
  // How many months the sales ownership lasts for this package type.
  // Overrides the global ownership period. Default 60 = 5 years.
  ownershipDurationMonths: integer("ownership_duration_months").notNull().default(60),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Package = typeof packagesTable.$inferSelect;
