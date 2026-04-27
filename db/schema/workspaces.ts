import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const workspaceTypeEnum = pgEnum("workspace_type", [
  "personal",
  "business",
]);

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  type: workspaceTypeEnum("type").default("business").notNull(),
  description: text("description"),
  brandName: varchar("brand_name", { length: 255 }),
  color: varchar("color", { length: 20 }).default("#1e3a5f"),
  icon: varchar("icon", { length: 10 }).default("🏢"),
  ownerId: varchar("owner_id", { length: 255 })
    .references(() => users.id)
    .notNull(),
  isArchived: boolean("is_archived").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
