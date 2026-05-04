import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  numeric,
  pgEnum,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { workspaces } from "./workspaces";

export const accountTypeEnum = pgEnum("account_type", [
  "cash",
  "bank",
  "credit",
  "stripe",
  "paypal",
  "crypto",
  "nomina",
  "other",
]);

export const currencyEnum = pgEnum("currency_type", [
  "MXN",
  "USD",
  "EUR",
  "BTC",
  "ETH",
  "USDT",
  "other",
]);

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id),
  userId: varchar("user_id", { length: 255 })
    .references(() => users.id)
    .notNull(),
  // null = cuenta personal; uuid = cuenta de negocio
  businessId: uuid("business_id"),
  name: varchar("name", { length: 255 }).notNull(),
  type: accountTypeEnum("type").default("bank").notNull(),
  currency: currencyEnum("currency").default("MXN").notNull(),
  // Saldo inicial manual; el saldo real = initialBalance + Σ transacciones
  initialBalance: numeric("initial_balance", { precision: 18, scale: 6 })
    .default("0")
    .notNull(),
  icon: varchar("icon", { length: 10 }).default("🏦"),
  color: varchar("color", { length: 20 }).default("#1e3a5f"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true).notNull(),
  walletAddress: varchar("wallet_address", { length: 20 }).unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
