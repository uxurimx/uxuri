import { pgTable, uuid, primaryKey } from "drizzle-orm/pg-core";
import { tasks } from "./tasks";
import { taskCategories } from "./task-categories";

export const taskCategoryLinks = pgTable(
  "task_category_links",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => taskCategories.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.categoryId] })],
);

export type TaskCategoryLink = typeof taskCategoryLinks.$inferSelect;
