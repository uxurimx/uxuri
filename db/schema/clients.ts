import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  date,
  pgEnum,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const clientStatusEnum = pgEnum("client_status", [
  "active",
  "inactive",
  "prospect",
]);

export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  company: varchar("company", { length: 255 }),
  status: clientStatusEnum("status").default("prospect").notNull(),
  notes: text("notes"),
  website: varchar("website", { length: 500 }),
  registrationDate: date("registration_date"),
  userId: varchar("user_id", { length: 255 }).references(() => users.id),
  createdBy: varchar("created_by", { length: 255 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
