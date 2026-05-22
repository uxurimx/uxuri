import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { jobApplications } from "./job-applications";

export const jobConversationRoleEnum = pgEnum("job_conversation_role", [
  "system",
  "assistant",
  "user",
]);

export type ConversationMetadata = {
  turnIndex?: number;
  scorecardGenerated?: boolean;
};

export const jobConversations = pgTable("job_conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id").notNull().references(() => jobApplications.id, { onDelete: "cascade" }),
  role: jobConversationRoleEnum("role").notNull(),
  content: text("content").notNull(),
  turnIndex: integer("turn_index").default(0).notNull(),
  metadata: jsonb("metadata").$type<ConversationMetadata>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type JobConversation = typeof jobConversations.$inferSelect;
export type NewJobConversation = typeof jobConversations.$inferInsert;
