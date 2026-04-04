import { pgTable, uuid, varchar, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { users } from "./users";
import { mktLeads } from "./mkt-leads";

export const mktInteractionTypeEnum = pgEnum("mkt_interaction_type", [
  "scraped",
  "sent",
  "replied",
  "followup_sent",
  "followup_replied",
  "interested",
  "not_interested",
  "call",
  "meeting",
  "converted",
  "lost",
  "note",
]);

export const mktInteractions = pgTable("mkt_interactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  leadId: uuid("lead_id").references(() => mktLeads.id, { onDelete: "cascade" }).notNull(),
  type: mktInteractionTypeEnum("type").notNull(),
  message: text("message"),                         // Mensaje enviado o respuesta recibida
  copyId: uuid("copy_id"),
  campaignId: uuid("campaign_id"),
  workerId: varchar("worker_id", { length: 255 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type MktInteraction = typeof mktInteractions.$inferSelect;
export type NewMktInteraction = typeof mktInteractions.$inferInsert;
