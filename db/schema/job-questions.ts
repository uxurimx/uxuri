import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { jobPostings } from "./job-postings";

export const jobQuestionTypeEnum = pgEnum("job_question_type", [
  "text",
  "textarea",
  "url",
  "video",
  "select",
  "multiselect",
  "choice",
]);

export const jobQuestions = pgTable("job_questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").notNull().references(() => jobPostings.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  type: jobQuestionTypeEnum("type").default("textarea").notNull(),
  options: text("options").array().default([]),
  isRequired: boolean("is_required").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  placeholder: varchar("placeholder", { length: 500 }),
  hint: text("hint"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type JobQuestion = typeof jobQuestions.$inferSelect;
export type NewJobQuestion = typeof jobQuestions.$inferInsert;
