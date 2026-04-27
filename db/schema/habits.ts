import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { workspaces } from "./workspaces";

export const habitFrequencyEnum = pgEnum("habit_frequency", [
  "daily",
  "weekdays",
  "weekends",
  "weekly",
]);

export const habits = pgTable("habits", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  frequency: habitFrequencyEnum("frequency").default("daily").notNull(),
  targetDays: integer("target_days").default(7).notNull(), // per week
  color: varchar("color", { length: 20 }).default("#1e3a5f").notNull(),
  icon: varchar("icon", { length: 10 }).default("✅").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Habit = typeof habits.$inferSelect;
export type NewHabit = typeof habits.$inferInsert;
