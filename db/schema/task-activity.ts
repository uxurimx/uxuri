import { pgTable, uuid, varchar, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { tasks } from "./tasks";
import { users } from "./users";

export const taskActivityTypeEnum = pgEnum("task_activity_type", [
  "created",
  "status_changed",
  "priority_changed",
  "assigned",
  "unassigned",
  "title_changed",
  "description_changed",
  "due_date_changed",
  "commented",
  "session_started",
  "session_paused",
  "session_stopped",
]);

export const taskActivity = pgTable("task_activity", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 255 }).references(() => users.id),
  userName: varchar("user_name", { length: 255 }),
  type: taskActivityTypeEnum("type").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type TaskActivity = typeof taskActivity.$inferSelect;
export type NewTaskActivity = typeof taskActivity.$inferInsert;
