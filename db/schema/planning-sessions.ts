import { pgTable, uuid, varchar, text, timestamp, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users";
import { workspaces } from "./workspaces";

export const planningContextTypeEnum = pgEnum("planning_context_type", [
  "blank",
  "task",
  "project",
  "objective",
  "client",
]);

export const planningStatusEnum = pgEnum("planning_status", ["active", "archived"]);

export const planningSessions = pgTable("planning_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id),
  title: varchar("title", { length: 500 }).notNull().default("Nueva sesión"),
  description: text("description"),
  contextType: planningContextTypeEnum("context_type").notNull().default("blank"),
  contextId: uuid("context_id"),
  contextSnapshot: jsonb("context_snapshot"),
  mindmapData: jsonb("mindmap_data"),
  status: planningStatusEnum("status").notNull().default("active"),
  createdBy: varchar("created_by", { length: 255 })
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type PlanningSession = typeof planningSessions.$inferSelect;
export type NewPlanningSession = typeof planningSessions.$inferInsert;
