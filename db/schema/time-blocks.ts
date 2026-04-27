import { pgTable, uuid, varchar, text, date, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";
import { tasks } from "./tasks";
import { workspaces } from "./workspaces";

export const timeBlocks = pgTable("time_blocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id),
  date: date("date").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
  startMinutes: integer("start_minutes").notNull(), // minutes from midnight
  endMinutes: integer("end_minutes").notNull(),
  color: varchar("color", { length: 20 }).default("#1e3a5f").notNull(),
  notes: text("notes"),
  done: boolean("done").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type TimeBlock = typeof timeBlocks.$inferSelect;
