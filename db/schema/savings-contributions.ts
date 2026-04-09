import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  date,
  numeric,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { savingsGoals } from "./savings-goals";

export const savingsContributions = pgTable("savings_contributions", {
  id: uuid("id").primaryKey().defaultRandom(),
  goalId: uuid("goal_id")
    .references(() => savingsGoals.id, { onDelete: "cascade" })
    .notNull(),
  userId: varchar("user_id", { length: 255 })
    .references(() => users.id)
    .notNull(),
  amount: numeric("amount", { precision: 18, scale: 6 }).notNull(),
  date: date("date").notNull(),
  note: text("note"),
  // Referencia blanda a transactions (no FK para evitar dependencia circular)
  transactionId: varchar("transaction_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SavingsContribution = typeof savingsContributions.$inferSelect;
export type NewSavingsContribution = typeof savingsContributions.$inferInsert;
