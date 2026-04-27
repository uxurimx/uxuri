import { pgTable, uuid, varchar, text, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { users } from "./users";
import { mktStrategies } from "./mkt-strategies";
import { workspaces } from "./workspaces";

export const mktCampaignStatusEnum = pgEnum("mkt_campaign_status", [
  "draft", "queued", "claimed", "scraping", "enriching",
  "ready", "scheduled", "running",
  "paused", "completed", "failed",
]);

export const mktCampaigns = pgTable("mkt_campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id),
  strategyId: uuid("strategy_id").references(() => mktStrategies.id),
  // copyId sin FK para evitar dependencia circular con mkt-copies
  copyId: uuid("copy_id"),
  title: varchar("title", { length: 255 }).notNull(),
  status: mktCampaignStatusEnum("status").default("draft").notNull(),
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  // Contadores actualizados por el worker / API bridge
  totalLeads: integer("total_leads").default(0).notNull(),
  contacted: integer("contacted").default(0).notNull(),
  responded: integer("responded").default(0).notNull(),
  interested: integer("interested").default(0).notNull(),
  converted: integer("converted").default(0).notNull(),
  // Worker que ejecuta esta campaña
  workerId:     varchar("worker_id", { length: 128 }),
  claimedAt:    timestamp("claimed_at"),
  failedCount:  integer("failed_count").default(0).notNull(),
  scrapedCount: integer("scraped_count").default(0).notNull(),
  errorMessage: text("error_message"),
  notes:        text("notes"),
  assignedTo:   varchar("assigned_to", { length: 255 }).references(() => users.id),
  createdBy: varchar("created_by", { length: 255 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type MktCampaign = typeof mktCampaigns.$inferSelect;
export type NewMktCampaign = typeof mktCampaigns.$inferInsert;
