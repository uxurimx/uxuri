import {
  pgTable,
  uuid,
  varchar,
  text,
  date,
  integer,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { workspaces } from "./workspaces";

export const journalEntries = pgTable("journal_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id),
  date: date("date").notNull(),
  mood: integer("mood"),          // 1-5
  intention: text("intention"),   // ¿Qué quiero lograr hoy?
  gratitude: text("gratitude"),   // 3 cosas por las que estoy agradecido
  wins: text("wins"),             // Victorias del día
  reflection: text("reflection"), // Reflexión libre
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("journal_entry_unique").on(table.userId, table.date),
]);

export type JournalEntry = typeof journalEntries.$inferSelect;
