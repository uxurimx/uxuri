import { pgTable, uuid, text, timestamp, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { planningSessions } from "./planning-sessions";

export const planningMessageRoleEnum = pgEnum("planning_message_role", ["user", "assistant"]);

export type PlanningMessageMetadata = {
  commandType: "task" | "project" | "objective" | "note";
  entityId: string;
  entityTitle: string;
  url: string;
};

export const planningMessages = pgTable("planning_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => planningSessions.id, { onDelete: "cascade" }),
  role: planningMessageRoleEnum("role").notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata").$type<PlanningMessageMetadata>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type PlanningMessage = typeof planningMessages.$inferSelect;
export type NewPlanningMessage = typeof planningMessages.$inferInsert;
