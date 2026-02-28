import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  date,
  pgEnum,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { clients } from "./clients";

export const projectStatusEnum = pgEnum("project_status", [
  "planning",
  "active",
  "paused",
  "completed",
  "cancelled",
]);

export const priorityEnum = pgEnum("priority", ["low", "medium", "high"]);

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  clientId: uuid("client_id").references(() => clients.id),
  status: projectStatusEnum("status").default("planning").notNull(),
  priority: priorityEnum("priority").default("medium").notNull(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  createdBy: varchar("created_by", { length: 255 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
