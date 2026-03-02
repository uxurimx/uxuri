import { pgTable, uuid, varchar, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { tasks } from "./tasks";

export const subtasks = pgTable("task_subtasks", {
  id:        uuid("id").primaryKey().defaultRandom(),
  taskId:    uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  title:     varchar("title", { length: 255 }).notNull(),
  done:      boolean("done").default(false).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
