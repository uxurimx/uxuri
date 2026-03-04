import {
  pgTable,
  uuid,
  varchar,
  boolean,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { objectives } from "./objectives";

export const objectiveMilestones = pgTable("objective_milestones", {
  id: uuid("id").primaryKey().defaultRandom(),
  objectiveId: uuid("objective_id").references(() => objectives.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  done: boolean("done").default(false).notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ObjectiveMilestone = typeof objectiveMilestones.$inferSelect;
export type NewObjectiveMilestone = typeof objectiveMilestones.$inferInsert;
