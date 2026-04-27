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

export const contextEntityTypeEnum = pgEnum("context_entity_type", [
  "client",
  "project",
  "objective",
]);

export const contextEntries = pgTable("context_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id),
  entityType: contextEntityTypeEnum("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  content: text("content").notNull(),
  userId: varchar("user_id", { length: 255 }).references(() => users.id),
  userName: varchar("user_name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ContextEntry = typeof contextEntries.$inferSelect;
export type NewContextEntry = typeof contextEntries.$inferInsert;
