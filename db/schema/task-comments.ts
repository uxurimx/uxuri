import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { tasks } from "./tasks";
import { users } from "./users";

export const taskComments = pgTable("task_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 255 }).references(() => users.id), // nullable for AI agent comments
  userName: varchar("user_name", { length: 255 }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type TaskComment = typeof taskComments.$inferSelect;
