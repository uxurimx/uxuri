import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  date,
  numeric,
  pgEnum,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { clients } from "./clients";
import { projects } from "./projects";
import { accounts, currencyEnum } from "./accounts";
import { workspaces } from "./workspaces";

export const transactionTypeEnum = pgEnum("transaction_type", [
  "income",
  "expense",
  "transfer",
]);

export const transactionStatusEnum = pgEnum("transaction_status", [
  "completed",
  "pending",
  "cancelled",
]);

export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id),
  userId: varchar("user_id", { length: 255 })
    .references(() => users.id)
    .notNull(),
  accountId: uuid("account_id")
    .references(() => accounts.id)
    .notNull(),
  // Solo para transfers entre cuentas propias
  toAccountId: uuid("to_account_id").references(() => accounts.id),
  // Contexto opcional
  businessId: uuid("business_id"),
  clientId: uuid("client_id").references(() => clients.id),
  projectId: uuid("project_id").references(() => projects.id),
  // Dinero
  type: transactionTypeEnum("type").notNull(),
  amount: numeric("amount", { precision: 18, scale: 6 }).notNull(),
  currency: currencyEnum("currency").default("MXN").notNull(),
  // Para normalizar reportes cuando la cuenta es USD/EUR/etc
  exchangeRateMXN: numeric("exchange_rate_mxn", { precision: 18, scale: 6 }),
  // Monto real recibido en la cuenta destino (diferente a amount cuando hay conversión de moneda)
  toAmount: numeric("to_amount", { precision: 18, scale: 6 }),
  // Clasificación
  category: varchar("category", { length: 50 }),
  description: varchar("description", { length: 500 }).notNull(),
  date: date("date").notNull(),
  status: transactionStatusEnum("status").default("completed").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
