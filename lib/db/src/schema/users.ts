import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["ADMIN", "DISTRIBUTOR", "SALES"] }).notNull(),
  distributorId: integer("distributor_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type User = typeof usersTable.$inferSelect;
