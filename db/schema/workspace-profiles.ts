import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces";

export const workspaceProfiles = pgTable("workspace_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 100 }).notNull(),         // slug: "admin", "programador", "tester", etc.
  label: varchar("label", { length: 100 }).notNull(),        // visible: "Administrador", "Programador"
  description: text("description"),
  color: varchar("color", { length: 20 }).default("#1e3a5f"),
  icon: varchar("icon", { length: 10 }).default("👤"),
  permissions: text("permissions").array().notNull().default([]),       // paths accesibles
  sidebarSections: text("sidebar_sections").array().notNull().default([]), // grupos visibles
  defaultRoute: varchar("default_route", { length: 200 }).default("/dashboard"),
  isSystem: boolean("is_system").default(false).notNull(),   // los seed no se borran
  sortOrder: text("sort_order"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type WorkspaceProfile = typeof workspaceProfiles.$inferSelect;
export type NewWorkspaceProfile = typeof workspaceProfiles.$inferInsert;
