import { pgTable, uuid, varchar, text, integer, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";
import { agents } from "./agents";
import { chatChannels } from "./chat-channels";

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  channelId: uuid("channel_id")
    .notNull()
    .references(() => chatChannels.id, { onDelete: "cascade" }),
  // Nullable: null when message is from an AI agent
  userId: varchar("user_id", { length: 255 })
    .references(() => users.id, { onDelete: "cascade" }),
  // Set when message is from an AI agent
  agentId: uuid("agent_id").references(() => agents.id, { onDelete: "cascade" }),
  userName: varchar("user_name", { length: 255 }).notNull(),
  content: text("content"), // null if file-only message
  fileUrl: varchar("file_url", { length: 1000 }),
  fileName: varchar("file_name", { length: 255 }),
  fileType: varchar("file_type", { length: 100 }),
  fileSize: integer("file_size"), // bytes
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
