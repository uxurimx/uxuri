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

export const projectPaymentTypeEnum = pgEnum("project_payment_type", [
  "anticipo",
  "abono",
  "pago_final",
  "reembolso",
  "otro",
]);

export const projectPaymentStatusEnum = pgEnum("project_payment_status", [
  "pending",
  "paid",
  "overdue",
  "cancelled",
]);

export const projectPaymentMethodEnum = pgEnum("project_payment_method", [
  "transferencia",
  "efectivo",
  "tarjeta",
  "paypal",
  "crypto",
  "otro",
]);

export const projectPayments = pgTable("project_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  clientId: uuid("client_id").references(() => clients.id),
  // FK suave a fase (sin import circular)
  phaseId: uuid("phase_id"),
  concept: varchar("concept", { length: 500 }).notNull(),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("MXN").notNull(),
  type: projectPaymentTypeEnum("type").default("abono").notNull(),
  status: projectPaymentStatusEnum("status").default("pending").notNull(),
  method: projectPaymentMethodEnum("method"),
  dueDate: date("due_date"),
  paidAt: timestamp("paid_at"),
  notes: text("notes"),
  // Referencia/comprobante
  reference: varchar("reference", { length: 255 }),
  createdBy: varchar("created_by", { length: 255 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ProjectPayment = typeof projectPayments.$inferSelect;
export type NewProjectPayment = typeof projectPayments.$inferInsert;
