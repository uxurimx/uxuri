import { pgTable, uuid, varchar, text, integer, timestamp, date } from "drizzle-orm/pg-core";
import { smokeSessions } from "./smoke-sessions";
import { users } from "./users";

export const deepBreaths = pgTable("deep_breaths", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id),
  sessionId: uuid("session_id").references(() => smokeSessions.id, { onDelete: "set null" }),
  durationSeconds: integer("duration_seconds").notNull(),
  breathType: varchar("breath_type", { length: 20 }).default("inhale"),
  tripDurationSeconds: integer("trip_duration_seconds"),
  tripDetails: text("trip_details"),
  minutesMark: integer("minutes_mark"),
  date: date("date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type DeepBreath = typeof deepBreaths.$inferSelect;
export type NewDeepBreath = typeof deepBreaths.$inferInsert;
