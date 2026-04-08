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
import { bills } from "./bills";
import { currencyEnum } from "./accounts";

export const billPaymentStatusEnum = pgEnum("bill_payment_status", [
  "paid",
  "skipped",
]);

export const billPayments = pgTable("bill_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  billId: uuid("bill_id")
    .references(() => bills.id, { onDelete: "cascade" })
    .notNull(),
  userId: varchar("user_id", { length: 255 })
    .references(() => users.id)
    .notNull(),
  paidDate: date("paid_date").notNull(),
  amount: numeric("amount", { precision: 18, scale: 6 }).notNull(),
  currency: currencyEnum("currency").default("MXN").notNull(),
  status: billPaymentStatusEnum("status").default("paid").notNull(),
  // Si se creó una transacción automáticamente, referenciamos su id (sin FK)
  transactionId: uuid("transaction_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type BillPayment = typeof billPayments.$inferSelect;
export type NewBillPayment = typeof billPayments.$inferInsert;
