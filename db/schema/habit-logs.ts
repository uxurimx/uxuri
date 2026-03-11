import {
  pgTable,
  uuid,
  varchar,
  date,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { habits } from "./habits";

export const habitLogs = pgTable("habit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  habitId: uuid("habit_id").notNull().references(() => habits.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id),
  date: date("date").notNull(),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("habit_log_unique").on(table.habitId, table.date),
]);

export type HabitLog = typeof habitLogs.$inferSelect;
