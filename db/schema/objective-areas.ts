import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { objectives } from "./objectives";

export const objectiveAreas = pgTable("objective_areas", {
  id: uuid("id").primaryKey().defaultRandom(),
  objectiveId: uuid("objective_id")
    .references(() => objectives.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 20 }).default("#3b82f6").notNull(),
  emoji: varchar("emoji", { length: 10 }),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ObjectiveArea = typeof objectiveAreas.$inferSelect;
export type NewObjectiveArea = typeof objectiveAreas.$inferInsert;
