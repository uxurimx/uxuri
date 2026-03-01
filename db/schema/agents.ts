import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  doublePrecision,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  specialty: varchar("specialty", { length: 100 }),
  description: text("description"),
  avatar: varchar("avatar", { length: 10 }).default("🤖").notNull(),
  color: varchar("color", { length: 20 }).default("#1e3a5f").notNull(),
  aiModel: varchar("ai_model", { length: 100 }),
  aiPrompt: text("ai_prompt"),
  maxTokens: integer("max_tokens"),
  tokenBudget: integer("token_budget"), // monthly token budget (null = sin límite)
  temperature: doublePrecision("temperature"),
  createdBy: varchar("created_by", { length: 255 }).references(() => users.id),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
