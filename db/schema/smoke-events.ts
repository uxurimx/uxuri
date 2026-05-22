import { pgTable, uuid, varchar, text, integer, timestamp } from "drizzle-orm/pg-core";
import { smokeSessions } from "./smoke-sessions";

export const smokeEvents = pgTable("smoke_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => smokeSessions.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 255 }).notNull(),
  minutesMark: integer("minutes_mark").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SmokeEvent = typeof smokeEvents.$inferSelect;
export type NewSmokeEvent = typeof smokeEvents.$inferInsert;
