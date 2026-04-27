import { pgTable, uuid, varchar, text, date, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./users";
import { workspaces } from "./workspaces";

export const weeklyReviews = pgTable("weekly_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id),
  weekStart: date("week_start").notNull(), // Monday ISO date
  workedWell: text("worked_well"),
  didntWork: text("didnt_work"),
  biggestWin: text("biggest_win"),
  mainLesson: text("main_lesson"),
  nextWeekTop3: text("next_week_top3"),
  energyLevel: varchar("energy_level", { length: 10 }), // low/medium/high
  overallRating: varchar("overall_rating", { length: 5 }), // 1-5
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("weekly_review_unique").on(table.userId, table.weekStart),
]);

export type WeeklyReview = typeof weeklyReviews.$inferSelect;
