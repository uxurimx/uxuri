import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  date,
  boolean,
  numeric,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { accounts, currencyEnum } from "./accounts";
import { workspaces } from "./workspaces";

export const billFrequencyEnum = pgEnum("bill_frequency", [
  "weekly",
  "biweekly",
  "monthly",
  "bimonthly",
  "quarterly",
  "yearly",
  "once",
]);

export const bills = pgTable("bills", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id),
  userId: varchar("user_id", { length: 255 })
    .references(() => users.id)
    .notNull(),
  // Cuenta que se carga por defecto al pagar
  accountId: uuid("account_id").references(() => accounts.id),
  // Negocio dueño del gasto (sin FK para evitar dep circular)
  businessId: uuid("business_id"),
  name: varchar("name", { length: 200 }).notNull(),
  amount: numeric("amount", { precision: 18, scale: 6 }).notNull(),
  currency: currencyEnum("currency").default("MXN").notNull(),
  frequency: billFrequencyEnum("frequency").default("monthly").notNull(),
  // Próxima fecha de vencimiento
  nextDueDate: date("next_due_date").notNull(),
  category: varchar("category", { length: 50 }),
  isActive: boolean("is_active").default(true).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Bill = typeof bills.$inferSelect;
export type NewBill = typeof bills.$inferInsert;
