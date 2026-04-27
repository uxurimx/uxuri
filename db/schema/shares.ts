import { pgTable, uuid, varchar, timestamp, uniqueIndex, pgEnum } from "drizzle-orm/pg-core";
import { users } from "./users";
import { workspaces } from "./workspaces";

export const sharePermissionEnum = pgEnum("share_permission", ["view", "edit"]);

export const shareResourceTypeEnum = pgEnum("share_resource_type", [
  "objective", "project", "client", "task",
]);

export const shares = pgTable("shares", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id),
  resourceType: shareResourceTypeEnum("resource_type").notNull(),
  resourceId: uuid("resource_id").notNull(),
  ownerId: varchar("owner_id", { length: 255 }).notNull().references(() => users.id),
  sharedWithId: varchar("shared_with_id", { length: 255 }).notNull().references(() => users.id),
  permission: sharePermissionEnum("permission").default("view").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("share_unique").on(table.resourceType, table.resourceId, table.sharedWithId),
]);

export type Share = typeof shares.$inferSelect;
