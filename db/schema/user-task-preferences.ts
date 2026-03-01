import { pgTable, uuid, varchar, integer, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./users";
import { tasks } from "./tasks";

export const userTaskPreferences = pgTable(
  "user_task_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id),
    taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order"),
    personalDone: boolean("personal_done").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("user_task_pref_unique").on(table.userId, table.taskId)]
);

export type UserTaskPreference = typeof userTaskPreferences.$inferSelect;
export type NewUserTaskPreference = typeof userTaskPreferences.$inferInsert;
