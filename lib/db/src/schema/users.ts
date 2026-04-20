import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const USER_ROLES = ["ADMIN", "OPERATIONS", "DISTRIBUTOR", "SALES"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: USER_ROLES }).notNull(),
  distributorId: integer("distributor_id"),
  // Additional profile fields for sales reps & distributors
  phone: text("phone"),
  internalCode: text("internal_code"),
  status: text("status", { enum: USER_STATUSES }).notNull().default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type User = typeof usersTable.$inferSelect;
