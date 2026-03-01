import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { tasks } from "./tasks";

export const agentMessages = pgTable("agent_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull(), // 'agent' | 'user'
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AgentMessage = typeof agentMessages.$inferSelect;
export type NewAgentMessage = typeof agentMessages.$inferInsert;
