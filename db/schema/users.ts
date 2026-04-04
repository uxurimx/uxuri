import { pgTable, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";

export type NavLayoutItem = { id: string; visible: boolean; order: number };

export const users = pgTable("users", {
  id: varchar("id", { length: 255 }).primaryKey(), // Clerk user ID
  email: varchar("email", { length: 255 }).unique().notNull(),
  name: varchar("name", { length: 255 }),
  imageUrl: varchar("image_url", { length: 1024 }),
  role: varchar("role", { length: 100 }).default("client").notNull(), // nombre del rol
  createdAt:  timestamp("created_at").defaultNow().notNull(),
  updatedAt:  timestamp("updated_at").defaultNow().notNull(),
  navLayout:  jsonb("nav_layout").$type<NavLayoutItem[]>(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
