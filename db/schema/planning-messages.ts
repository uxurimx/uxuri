import { pgTable, uuid, varchar, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { planningSessions } from "./planning-sessions";

export const planningMessageRoleEnum = pgEnum("planning_message_role", ["user", "assistant"]);

export const planningMessages = pgTable("planning_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => planningSessions.id, { onDelete: "cascade" }),
  role: planningMessageRoleEnum("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type PlanningMessage = typeof planningMessages.$inferSelect;
export type NewPlanningMessage = typeof planningMessages.$inferInsert;
