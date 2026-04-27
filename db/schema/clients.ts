import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  date,
  numeric,
  pgEnum,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { workspaces } from "./workspaces";

export const clientStatusEnum = pgEnum("client_status", [
  "active",
  "inactive",
  "prospect",
]);

// Etapas del pipeline CRM (más granular que status)
export const clientPipelineStageEnum = pgEnum("client_pipeline_stage", [
  "contacto",       // primer mensaje / señal
  "lead",           // datos capturados, sin calificar
  "prospecto",      // calificado, hay interés real
  "propuesta",      // propuesta enviada
  "negociacion",    // negociando términos/precio
  "cliente",        // cerrado, ya es cliente
  "recurrente",     // cliente activo con proyectos repetidos
  "churned",        // se fue / canceló
]);

export const clientSourceChannelEnum = pgEnum("client_source_channel", [
  "whatsapp",
  "instagram",
  "facebook",
  "referral",
  "web",
  "directo",
  "email",
  "otro",
]);

export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  company: varchar("company", { length: 255 }),
  status: clientStatusEnum("status").default("prospect").notNull(),
  notes: text("notes"),
  website: varchar("website", { length: 500 }),
  registrationDate: date("registration_date"),
  userId: varchar("user_id", { length: 255 }).references(() => users.id),
  businessId: uuid("business_id"),
  createdBy: varchar("created_by", { length: 255 }).references(() => users.id),
  // ── CRM Pipeline ──────────────────────────────────────────────────────────
  pipelineStage: clientPipelineStageEnum("pipeline_stage").default("contacto"),
  sourceBusinessId: uuid("source_business_id"),           // qué negocio tuyo lo generó
  sourceChannel: clientSourceChannelEnum("source_channel"), // canal de entrada
  firstContactDate: date("first_contact_date"),           // cuándo fue el primer contacto
  estimatedValue: numeric("estimated_value", { precision: 18, scale: 2 }), // valor estimado del deal
  // ─────────────────────────────────────────────────────────────────────────
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
