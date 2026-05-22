import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { jobPostings } from "./job-postings";
import { users } from "./users";

export const jobApplicationStatusEnum = pgEnum("job_application_status", [
  "new",
  "reviewing",
  "shortlisted",
  "interview",
  "hired",
  "rejected",
]);

export type JobApplicationAnswer = {
  questionId: string;
  value: string | string[];
};

export type JobAiFlag = {
  type: "red_flag" | "green_flag" | "neutral";
  label: string;
  detail?: string;
};

export const jobApplications = pgTable("job_applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").notNull().references(() => jobPostings.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 200 }).notNull(),
  email: varchar("email", { length: 200 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  // ── Respuestas (modo form) ─────────────────────────────────────────────────
  answers: jsonb("answers").$type<JobApplicationAnswer[]>().default([]).notNull(),
  // ── Submission (modo challenge) ────────────────────────────────────────────
  submissionUrl: varchar("submission_url", { length: 1000 }),
  submissionNotes: text("submission_notes"),
  submissionFileUrl: varchar("submission_file_url", { length: 1000 }),
  // ── Video (modo video) ────────────────────────────────────────────────────
  videoResponses: jsonb("video_responses").$type<{ questionIndex: number; videoUrl: string; transcript?: string }[]>().default([]),
  // ── Conversación IA (modo conversation) ───────────────────────────────────
  conversationId: uuid("conversation_id"), // soft ref → job_conversations.applicationId
  // ── AI Scoring ────────────────────────────────────────────────────────────
  aiScore: integer("ai_score"),            // 1-10 generado por IA
  aiSummary: text("ai_summary"),           // resumen en 3-5 líneas
  aiFlags: jsonb("ai_flags").$type<JobAiFlag[]>().default([]),
  aiRecommendation: varchar("ai_recommendation", { length: 20 }), // shortlist | reject | review
  aiScoredAt: timestamp("ai_scored_at"),
  // ── Pipeline ─────────────────────────────────────────────────────────────
  status: jobApplicationStatusEnum("status").default("new").notNull(),
  score: integer("score"),                 // rating manual del admin (1-5)
  notes: text("notes"),
  source: varchar("source", { length: 100 }),
  appliedAt: timestamp("applied_at").defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: varchar("reviewed_by", { length: 255 }).references(() => users.id),
});

export type JobApplication = typeof jobApplications.$inferSelect;
export type NewJobApplication = typeof jobApplications.$inferInsert;
