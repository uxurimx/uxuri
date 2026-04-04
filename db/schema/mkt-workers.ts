import { pgTable, uuid, varchar, text, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";

export const mktWorkerTypeEnum = pgEnum("mkt_worker_type", [
  "laptop", "rpi", "bbb", "aws", "other",
]);

export const mktWorkerStatusEnum = pgEnum("mkt_worker_status", [
  "online", "busy", "offline",
]);

export const mktWorkers = pgTable("mkt_workers", {
  id:                uuid("id").primaryKey().defaultRandom(),
  // ID único del nodo — hostname + uuid corto, persistente en .worker_id
  workerId:          varchar("worker_id", { length: 128 }).unique().notNull(),
  hostname:          varchar("hostname", { length: 255 }),
  workerType:        mktWorkerTypeEnum("worker_type").default("laptop"),
  status:            mktWorkerStatusEnum("status").default("online").notNull(),
  // ["scrape", "whatsapp", "scoring"]
  capabilities:      jsonb("capabilities").$type<string[]>().default([]),
  currentCampaignId: uuid("current_campaign_id"),
  tunnelUrl:         varchar("tunnel_url", { length: 512 }),
  lastHeartbeat:     timestamp("last_heartbeat").defaultNow().notNull(),
  registeredAt:      timestamp("registered_at").defaultNow().notNull(),
});

export type MktWorker = typeof mktWorkers.$inferSelect;
export type NewMktWorker = typeof mktWorkers.$inferInsert;
