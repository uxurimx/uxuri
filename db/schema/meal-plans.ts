import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  date,
  numeric,
  integer,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const mealTimeEnum = pgEnum("meal_time", [
  "desayuno",
  "comida",
  "cena",
  "snack",
]);

export const mealPlans = pgTable(
  "meal_plans",
  {
    id:        uuid("id").primaryKey().defaultRandom(),
    userId:    varchar("user_id", { length: 255 }).references(() => users.id).notNull(),
    weekStart: date("week_start").notNull(), // Lunes de la semana YYYY-MM-DD
    notes:     text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("meal_plan_week_unique").on(t.userId, t.weekStart)],
);

export const mealEntries = pgTable("meal_entries", {
  id:            uuid("id").primaryKey().defaultRandom(),
  planId:        uuid("plan_id").references(() => mealPlans.id, { onDelete: "cascade" }).notNull(),
  userId:        varchar("user_id", { length: 255 }).references(() => users.id).notNull(),
  dayOfWeek:     integer("day_of_week").notNull(), // 0=Lun … 6=Dom
  mealTime:      mealTimeEnum("meal_time").notNull(),
  name:          varchar("name", { length: 200 }).notNull(),
  estimatedCost: numeric("estimated_cost", { precision: 10, scale: 2 }),
  notes:         text("notes"),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
  updatedAt:     timestamp("updated_at").defaultNow().notNull(),
});

export type MealPlan  = typeof mealPlans.$inferSelect;
export type MealEntry = typeof mealEntries.$inferSelect;
