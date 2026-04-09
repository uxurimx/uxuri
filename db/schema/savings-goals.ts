import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  date,
  boolean,
  numeric,
  pgEnum,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { currencyEnum } from "./accounts";
import { objectives } from "./objectives";

export const savingsGoalCategoryEnum = pgEnum("savings_goal_category", [
  "viaje",
  "compra",
  "emergencia",
  "inversion",
  "educacion",
  "salud",
  "hogar",
  "otro",
]);

export const savingsGoals = pgTable("savings_goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 })
    .references(() => users.id)
    .notNull(),
  businessId: uuid("business_id"),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  targetAmount: numeric("target_amount", { precision: 18, scale: 6 }).notNull(),
  currency: currencyEnum("currency").default("MXN").notNull(),
  category: savingsGoalCategoryEnum("category").default("otro").notNull(),
  deadline: date("deadline"),
  // Vínculo opcional al módulo de objetivos
  objectiveId: uuid("objective_id").references(() => objectives.id, { onDelete: "set null" }),
  isCompleted: boolean("is_completed").default(false).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type SavingsGoal = typeof savingsGoals.$inferSelect;
export type NewSavingsGoal = typeof savingsGoals.$inferInsert;
