import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { tasks } from "./tasks";
import { projects } from "./projects";

export const timeSessionStatusEnum = pgEnum("time_session_status", [
  "running",
  "paused",
  "stopped",
]);

export const timeSessions = pgTable("time_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  description: text("description"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  elapsedSeconds: integer("elapsed_seconds").default(0).notNull(),
  status: timeSessionStatusEnum("status").default("running").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type TimeSession = typeof timeSessions.$inferSelect;
export type NewTimeSession = typeof timeSessions.$inferInsert;
