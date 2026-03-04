import { pgTable, uuid } from "drizzle-orm/pg-core";
import { objectives } from "./objectives";
import { projects } from "./projects";
import { tasks } from "./tasks";
import { agents } from "./agents";

export const objectiveProjects = pgTable("objective_projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  objectiveId: uuid("objective_id").references(() => objectives.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
});

export const objectiveTasks = pgTable("objective_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  objectiveId: uuid("objective_id").references(() => objectives.id, { onDelete: "cascade" }),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
});

export const objectiveAgents = pgTable("objective_agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  objectiveId: uuid("objective_id").references(() => objectives.id, { onDelete: "cascade" }),
  agentId: uuid("agent_id").references(() => agents.id, { onDelete: "cascade" }),
});
