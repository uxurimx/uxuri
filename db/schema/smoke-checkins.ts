import { pgTable, uuid, varchar, integer, timestamp, text } from "drizzle-orm/pg-core";
import { smokeSessions } from "./smoke-sessions";

export const smokeCheckins = pgTable("smoke_checkins", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => smokeSessions.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 255 }).notNull(),
  minutesMark: integer("minutes_mark").notNull(),
  intensity: integer("intensity").notNull(),
  tags: text("tags").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SmokeCheckin = typeof smokeCheckins.$inferSelect;
