import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { objectives } from "./objectives";
import { users } from "./users";

export const objectiveAttachments = pgTable("objective_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  objectiveId: uuid("objective_id").references(() => objectives.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  url: text("url").notNull(),
  size: integer("size"),
  type: varchar("type", { length: 100 }),
  uploadedBy: varchar("uploaded_by", { length: 255 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ObjectiveAttachment = typeof objectiveAttachments.$inferSelect;
export type NewObjectiveAttachment = typeof objectiveAttachments.$inferInsert;
