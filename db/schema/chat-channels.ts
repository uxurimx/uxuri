import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";
import { agents } from "./agents";

export const chatChannels = pgTable("chat_channels", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  // 'general' | 'client' | 'project' | 'direct' | 'agent-dm'
  entityType: varchar("entity_type", { length: 20 }).notNull().default("general"),
  entityId: uuid("entity_id"), // references clients.id or projects.id
  // For direct messages: sorted pair "{userId1}|{userId2}"
  // For agent-dm: "agent:{agentId}|{userId}"
  dmKey: varchar("dm_key", { length: 600 }),
  // For agent-dm channels: the agent this channel is with
  agentId: uuid("agent_id").references(() => agents.id, { onDelete: "cascade" }),
  createdBy: varchar("created_by", { length: 255 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
