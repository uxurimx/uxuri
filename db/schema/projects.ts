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
import { clients } from "./clients";
import { workspaces } from "./workspaces";

export const projectStatusEnum = pgEnum("project_status", [
  "planning",
  "active",
  "paused",
  "completed",
  "cancelled",
]);

export const priorityEnum = pgEnum("priority", ["low", "medium", "high"]);

export const projectContractTypeEnum = pgEnum("project_contract_type", [
  "fixed",        // precio fijo total
  "hourly",       // por hora
  "retainer",     // mensualidad
  "per_phase",    // pago por fase completada
  "milestone",    // pago por hitos
]);

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  clientId: uuid("client_id").references(() => clients.id),
  status: projectStatusEnum("status").default("planning").notNull(),
  priority: priorityEnum("priority").default("medium").notNull(),
  privacy: varchar("privacy", { length: 10 }).default("public").notNull(),
  range: varchar("range", { length: 10 }),    // "short" | "long"
  category: varchar("category", { length: 100 }),
  startDate: date("start_date"),
  endDate: date("end_date"),
  createdBy: varchar("created_by", { length: 255 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  businessId: uuid("business_id"),
  // Ciclos
  cycleMinutes: integer("cycle_minutes"),
  lastCycleAt:  timestamp("last_cycle_at"),
  nextCycleAt:  timestamp("next_cycle_at"),
  momentum:     integer("momentum").default(100).notNull(),
  // ── Financiero ──────────────────────────────────────────────────────────
  totalAmount: numeric("total_amount", { precision: 18, scale: 2 }),
  currency: varchar("currency", { length: 10 }).default("MXN"),
  paymentType: projectContractTypeEnum("payment_type").default("fixed"),
  // ── Código vinculado ─────────────────────────────────────────────────────
  linkedCodePath: text("linked_code_path"),   // ruta local, ej. /home/dev/Projects/tekton/Projects/WB
  linkedRepo: varchar("linked_repo", { length: 500 }),  // git remote URL
  techStack: text("tech_stack"),              // notas de stack para contexto del agente
  // ────────────────────────────────────────────────────────────────────────
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
