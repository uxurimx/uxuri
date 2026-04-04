import {
  pgTable, uuid, varchar, text, timestamp,
  integer, real, jsonb, pgEnum, uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { clients } from "./clients";
import { mktStrategies } from "./mkt-strategies";
import { mktCampaigns } from "./mkt-campaigns";

export const mktLeadStatusEnum = pgEnum("mkt_lead_status", [
  "nuevo", "pendiente", "contactado", "interesado",
  "no_responde", "sin_whatsapp", "descartado", "cerrado",
]);

export const mktLeads = pgTable("mkt_leads", {
  id: uuid("id").primaryKey().defaultRandom(),

  // ── Datos scrapeados (mapeados 1:1 desde SQLite) ──────────────────────────
  sourceId: varchar("source_id", { length: 50 }),   // ID original del SQLite (para upsert)
  name: varchar("name", { length: 255 }),
  category: varchar("category", { length: 255 }),
  niche: varchar("niche", { length: 100 }),
  city: varchar("city", { length: 100 }),
  country: varchar("country", { length: 50 }).default("México"),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  website: varchar("website", { length: 500 }),
  menuUrl: varchar("menu_url", { length: 500 }),
  address: text("address"),
  query: varchar("query", { length: 255 }),
  rating: real("rating"),
  reviews: integer("reviews"),
  webSource: varchar("web_source", { length: 100 }),
  hasWhatsapp: integer("has_whatsapp"),             // null=sin verificar, 1=sí, 0=no
  score: integer("score"),                           // 1-10
  socialFb: varchar("social_fb", { length: 500 }),
  socialIg: varchar("social_ig", { length: 500 }),
  socialData: jsonb("social_data"),

  // ── Status y seguimiento ──────────────────────────────────────────────────
  status: mktLeadStatusEnum("status").default("nuevo").notNull(),
  notes: text("notes"),
  templateUsed: varchar("template_used", { length: 100 }),

  // ── Vinculación a campaña/estrategia/copy ────────────────────────────────
  strategyId: uuid("strategy_id").references(() => mktStrategies.id),
  campaignId: uuid("campaign_id").references(() => mktCampaigns.id),
  copyId: uuid("copy_id"),                           // FK a mkt_copies (sin import circular)

  // ── Worker que lo contactó ────────────────────────────────────────────────
  contactedBy: varchar("contacted_by", { length: 255 }).references(() => users.id),
  contactedAt: timestamp("contacted_at"),
  lastActivity: timestamp("last_activity"),

  // ── Follow-up ─────────────────────────────────────────────────────────────
  followupStep: integer("followup_step").default(0).notNull(),
  nextFollowup: timestamp("next_followup"),

  // ── Conversión ────────────────────────────────────────────────────────────
  convertedToClientId: uuid("converted_to_client_id").references(() => clients.id),
  convertedAt: timestamp("converted_at"),

  // ── Meta ──────────────────────────────────────────────────────────────────
  assignedTo: varchar("assigned_to", { length: 255 }).references(() => users.id),
  scrapedBy: varchar("scraped_by", { length: 255 }).references(() => users.id),
  scrapedAt: timestamp("scraped_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("mkt_leads_source_id_idx").on(t.sourceId),
]);

export type MktLead = typeof mktLeads.$inferSelect;
export type NewMktLead = typeof mktLeads.$inferInsert;
