import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { workspaces } from "./workspaces";

export const cyclePresets = pgTable("cycle_presets", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id),
  userId: varchar("user_id", { length: 255 }).references(() => users.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 50 }).notNull(),   // "5min", "1h", "3 días"
  minutes: integer("minutes").notNull(),               // duración en minutos
  isSystem: boolean("is_system").notNull().default(false),
  isHidden: boolean("is_hidden").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CyclePreset = typeof cyclePresets.$inferSelect;
export type NewCyclePreset = typeof cyclePresets.$inferInsert;
