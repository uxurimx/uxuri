import { pgTable, pgEnum, uuid, varchar, text, integer, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const smokeTypeEnum = pgEnum("smoke_type", ["sativa", "indica", "hybrid", "cbd", "hash", "concentrate"]);
export const smokeMethodEnum = pgEnum("smoke_method", ["joint", "pipe", "vape", "edible", "bong", "dab"]);
export const smokeAmountEnum = pgEnum("smoke_amount", ["micro", "low", "medium", "heavy", "very_heavy"]);
export const smokeStatusEnum = pgEnum("smoke_status", ["active", "closed"]);

export const smokeSessions = pgTable("smoke_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id),
  type: smokeTypeEnum("type").notNull(),
  method: smokeMethodEnum("method").notNull(),
  amount: smokeAmountEnum("amount").notNull(),
  strain: varchar("strain", { length: 255 }),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  elapsedSeconds: integer("elapsed_seconds"),
  targetDuration: integer("target_duration"),
  status: smokeStatusEnum("status").default("active").notNull(),
  moodBefore: integer("mood_before"),
  creativityRating: integer("creativity_rating"),
  relaxRating: integer("relax_rating"),
  focusRating: integer("focus_rating"),
  euphoriaRating: integer("euphoria_rating"),
  depthRating: integer("depth_rating"),
  moodAfter: integer("mood_after"),
  overallRating: integer("overall_rating"),
  summary: text("summary"),
  aiSummary: text("ai_summary"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SmokeSession = typeof smokeSessions.$inferSelect;
export type NewSmokeSession = typeof smokeSessions.$inferInsert;
