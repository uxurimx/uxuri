import { pgTable, pgEnum, uuid, varchar, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { smokeSessions } from "./smoke-sessions";

export const smokeNoteTypeEnum = pgEnum("smoke_note_type", ["text", "voice", "insight", "task"]);

export const smokeNotes = pgTable("smoke_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => smokeSessions.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 255 }).notNull(),
  content: text("content").notNull(),
  type: smokeNoteTypeEnum("type").default("text").notNull(),
  tags: text("tags").array(),
  minutesMark: integer("minutes_mark"),
  convertedToTask: boolean("converted_to_task").default(false).notNull(),
  taskId: uuid("task_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SmokeNote = typeof smokeNotes.$inferSelect;
export type NewSmokeNote = typeof smokeNotes.$inferInsert;
