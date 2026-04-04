import { pgTable, uuid, varchar, text, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { users } from "./users";

export const mktCopyTypeEnum = pgEnum("mkt_copy_type", [
  "whatsapp_msg", "email_subject", "email_body", "ig_dm", "script", "cta", "other",
]);

export const mktCopyStatusEnum = pgEnum("mkt_copy_status", [
  "draft", "review", "approved", "active", "archived",
]);

export const mktCopyFrameworkEnum = pgEnum("mkt_copy_framework", [
  "AIDA", "PAS", "social_proof", "FOMO", "custom",
]);

export const mktCopies = pgTable("mkt_copies", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 255 }).notNull(),
  // Template con variables: {nombre}, {ciudad}, {nicho}, {plataforma}
  content: text("content").notNull(),
  type: mktCopyTypeEnum("type").default("whatsapp_msg").notNull(),
  status: mktCopyStatusEnum("status").default("draft").notNull(),
  abVariant: varchar("ab_variant", { length: 1 }),  // "A", "B", "C"
  version: integer("version").default(1).notNull(),
  parentId: uuid("parent_id"),                       // UUID del copy original (A/B)
  framework: mktCopyFrameworkEnum("framework"),
  tone: varchar("tone", { length: 30 }),             // amigable, profesional, urgente, empático
  notes: text("notes"),
  createdBy: varchar("created_by", { length: 255 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type MktCopy = typeof mktCopies.$inferSelect;
export type NewMktCopy = typeof mktCopies.$inferInsert;
