import { pgTable, uuid, text, timestamp, varchar, unique } from "drizzle-orm/pg-core";
import { agents } from "./agents";
import { projects } from "./projects";
import { users } from "./users";

export const agentProjectAssignments = pgTable(
  "agent_project_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    scope: text("scope"),       // qué puede tocar el agente en este proyecto
    createdBy: varchar("created_by", { length: 255 }).references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.agentId, t.projectId)]
);

export type AgentProjectAssignment = typeof agentProjectAssignments.$inferSelect;
export type NewAgentProjectAssignment = typeof agentProjectAssignments.$inferInsert;
