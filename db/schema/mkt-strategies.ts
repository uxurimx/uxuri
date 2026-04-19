import { pgTable, uuid, varchar, text, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { users } from "./users";

export const mktStrategyStatusEnum = pgEnum("mkt_strategy_status", [
  "draft", "active", "paused", "completed",
]);

export const mktChannelEnum = pgEnum("mkt_channel", [
  "whatsapp", "email", "ig_dm", "whatsapp_email", "sms", "other",
]);

export const mktStrategies = pgTable("mkt_strategies", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  productOffered: text("product_offered"),       // "Página web", "Sistema CRM", "App móvil"
  targetNiche: varchar("target_niche", { length: 100 }),  // "dentistas", "abogados"
  targetCity: varchar("target_city", { length: 100 }),
  targetCountry: varchar("target_country", { length: 50 }).default("México"),
  channel: mktChannelEnum("channel").default("whatsapp").notNull(),
  status: mktStrategyStatusEnum("status").default("draft").notNull(),
  maxLeadsPerQuery: integer("max_leads_per_query").default(50),
  scraperTimeoutMin: integer("scraper_timeout_min").default(30),
  notes: text("notes"),
  createdBy: varchar("created_by", { length: 255 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type MktStrategy = typeof mktStrategies.$inferSelect;
export type NewMktStrategy = typeof mktStrategies.$inferInsert;
