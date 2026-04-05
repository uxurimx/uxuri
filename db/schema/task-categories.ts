import {
  pgTable,
  uuid,
  varchar,
  boolean,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const taskCategories = pgTable("task_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 7 }).notNull().default("#64748b"), // hex
  icon: varchar("icon", { length: 10 }).notNull().default("📌"),       // emoji
  isSystem: boolean("is_system").notNull().default(false),
  isHidden: boolean("is_hidden").notNull().default(false),             // user puede ocultar las del sistema
  createdBy: varchar("created_by", { length: 255 }).references(() => users.id), // null si isSystem
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type TaskCategory = typeof taskCategories.$inferSelect;
export type NewTaskCategory = typeof taskCategories.$inferInsert;
