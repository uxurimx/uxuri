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

export const jobApplications = pgTable("job_applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").notNull().references(() => jobPostings.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 200 }).notNull(),
  email: varchar("email", { length: 200 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  answers: jsonb("answers").$type<JobApplicationAnswer[]>().default([]).notNull(),
  status: jobApplicationStatusEnum("status").default("new").notNull(),
  score: integer("score"),
  notes: text("notes"),
  source: varchar("source", { length: 100 }),
  appliedAt: timestamp("applied_at").defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: varchar("reviewed_by", { length: 255 }).references(() => users.id),
});

export type JobApplication = typeof jobApplications.$inferSelect;
export type NewJobApplication = typeof jobApplications.$inferInsert;
