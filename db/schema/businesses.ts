import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { workspaces } from "./workspaces";

export const businessTypeEnum = pgEnum("business_type", [
  "saas",
  "agency",
  "product",
  "service",
  "household",
  "personal",
]);

export const businessStatusEnum = pgEnum("business_status", [
  "active",
  "paused",
  "archived",
]);

export const businesses = pgTable("businesses", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id),
  name: varchar("name", { length: 255 }).notNull(),
  type: businessTypeEnum("type").default("service").notNull(),
  description: text("description"),
  logo: varchar("logo", { length: 10 }).default("🏢"),
  color: varchar("color", { length: 20 }).default("#1e3a5f"),
  status: businessStatusEnum("status").default("active").notNull(),
  website: varchar("website", { length: 500 }),
  // Soft ref to projects (no FK to avoid circular dep)
  linkedProjectId: uuid("linked_project_id"),
  ownerId: varchar("owner_id", { length: 255 })
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Business = typeof businesses.$inferSelect;
export type NewBusiness = typeof businesses.$inferInsert;
