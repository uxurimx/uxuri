import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  date,
  pgEnum,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const objectiveStatusEnum = pgEnum("objective_status", [
  "draft",
  "active",
  "paused",
  "completed",
  "cancelled",
]);

export const objectives = pgTable("objectives", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: objectiveStatusEnum("status").default("draft").notNull(),
  priority: varchar("priority", { length: 20 }).default("medium").notNull(),
  targetDate: date("target_date"),
  createdBy: varchar("created_by", { length: 255 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Objective = typeof objectives.$inferSelect;
export type NewObjective = typeof objectives.$inferInsert;
