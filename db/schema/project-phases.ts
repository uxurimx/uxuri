import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  date,
  integer,
  numeric,
  pgEnum,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { projects } from "./projects";

export const projectPhaseStatusEnum = pgEnum("project_phase_status", [
  "pending",
  "active",
  "completed",
  "cancelled",
]);

export const projectPhases = pgTable("project_phases", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  order: integer("order").default(0).notNull(),
  status: projectPhaseStatusEnum("status").default("pending").notNull(),
  completionPercent: integer("completion_percent").default(0).notNull(),
  dueDate: date("due_date"),
  // Billing asociado a esta fase (opcional)
  billingAmount: numeric("billing_amount", { precision: 18, scale: 2 }),
  billingCurrency: varchar("billing_currency", { length: 10 }).default("MXN"),
  billedAt: timestamp("billed_at"),
  createdBy: varchar("created_by", { length: 255 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ProjectPhase = typeof projectPhases.$inferSelect;
export type NewProjectPhase = typeof projectPhases.$inferInsert;
