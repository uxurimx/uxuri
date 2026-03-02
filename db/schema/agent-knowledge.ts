import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { agents } from "./agents";

export const agentKnowledge = pgTable("agent_knowledge", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  // document | instruction | character
  type: varchar("type", { length: 50 }).default("document").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AgentKnowledge = typeof agentKnowledge.$inferSelect;
export type NewAgentKnowledge = typeof agentKnowledge.$inferInsert;
