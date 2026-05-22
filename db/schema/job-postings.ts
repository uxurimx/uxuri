import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { workspaces } from "./workspaces";
import { businesses } from "./businesses";

export const jobStatusEnum = pgEnum("job_status", [
  "draft",
  "open",
  "paused",
  "closed",
]);

export const jobEmploymentTypeEnum = pgEnum("job_employment_type", [
  "fixed_salary",
  "commission",
  "mixed",
  "equity_partner",
]);

export const jobApplicationTypeEnum = pgEnum("job_application_type", [
  "form",         // Formulario clásico multi-step
  "challenge",    // Reto con deadline + submit de evidencia
  "conversation", // Pre-entrevista con agente IA
  "video",        // Preguntas con respuesta en video (90s c/u)
  "hybrid",       // Secuencia de gates configurables
]);

export const jobPostings = pgTable("job_postings", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id),
  businessId: uuid("business_id").references(() => businesses.id),
  createdBy: varchar("created_by", { length: 255 }).notNull().references(() => users.id),
  title: varchar("title", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 200 }).notNull().unique(),
  tagline: text("tagline"),
  description: text("description"),
  requirements: text("requirements"),
  employmentType: jobEmploymentTypeEnum("employment_type").default("commission"),
  status: jobStatusEnum("status").default("draft").notNull(),
  // ── Tipo de aplicación ────────────────────────────────────────────────────
  applicationType: jobApplicationTypeEnum("application_type").default("form").notNull(),
  // ── Challenge mode ────────────────────────────────────────────────────────
  challengeBrief: text("challenge_brief"),
  challengeDeadlineHours: integer("challenge_deadline_hours").default(48),
  // ── Conversation mode (briefing para Kairos) ──────────────────────────────
  conversationContext: text("conversation_context"),
  // ─────────────────────────────────────────────────────────────────────────
  closesAt: timestamp("closes_at"),
  maxApplications: integer("max_applications"),
  isPublic: boolean("is_public").default(true).notNull(),
  viewCount: integer("view_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type JobPosting = typeof jobPostings.$inferSelect;
export type NewJobPosting = typeof jobPostings.$inferInsert;
