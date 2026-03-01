import { pgTable, uuid, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const workflowColumns = pgTable("workflow_columns", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 20 }).default("#94a3b8").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdBy: varchar("created_by", { length: 255 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type WorkflowColumn = typeof workflowColumns.$inferSelect;
export type NewWorkflowColumn = typeof workflowColumns.$inferInsert;
