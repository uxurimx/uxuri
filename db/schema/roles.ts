import { pgTable, uuid, varchar, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const roles = pgTable("roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).unique().notNull(),   // slug interno
  label: varchar("label", { length: 100 }).notNull(),           // nombre visible
  permissions: text("permissions").array().notNull().default([]), // paths accesibles
  isDefault: boolean("is_default").default(false).notNull(),    // rol para nuevos usuarios
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type RoleRecord = typeof roles.$inferSelect;
export type NewRoleRecord = typeof roles.$inferInsert;
