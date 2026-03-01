import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";
import { agents } from "./agents";
import { tasks } from "./tasks";
import { users } from "./users";

export const agentSessionStatusEnum = pgEnum("agent_session_status", [
  "running",
  "paused",
  "done",
]);

export const agentSessions = pgTable("agent_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").notNull().references(() => agents.id),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  // startedAt = when the CURRENT run segment began (resets on resume)
  startedAt: timestamp("started_at").defaultNow().notNull(),
  pausedAt: timestamp("paused_at"),
  endedAt: timestamp("ended_at"),
  // Accumulated seconds from previous run segments (before latest start/resume)
  elapsedSeconds: integer("elapsed_seconds").default(0).notNull(),
  status: agentSessionStatusEnum("status").default("running").notNull(),
  notes: text("notes"),
  tokenCost: integer("token_cost"),
  createdBy: varchar("created_by", { length: 255 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AgentSession = typeof agentSessions.$inferSelect;
export type NewAgentSession = typeof agentSessions.$inferInsert;
