import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  numeric,
  pgEnum,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { currencyEnum } from "./accounts";

export const budgetPeriodEnum = pgEnum("budget_period", [
  "weekly",
  "monthly",
  "yearly",
]);

export const budgets = pgTable("budgets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 })
    .references(() => users.id)
    .notNull(),
  // null = presupuesto personal; uuid = presupuesto de negocio
  businessId: uuid("business_id"),
  category: varchar("category", { length: 50 }).notNull(),
  limitAmount: numeric("limit_amount", { precision: 18, scale: 6 }).notNull(),
  currency: currencyEnum("currency").default("MXN").notNull(),
  period: budgetPeriodEnum("period").default("monthly").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
