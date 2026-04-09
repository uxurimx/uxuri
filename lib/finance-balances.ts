import { db } from "@/db";
import { transactions } from "@/db/schema";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";

/**
 * Computes real account balances from transactions.
 *
 * Balance = initialBalance
 *   + SUM(income)
 *   - SUM(expense)
 *   - SUM(outgoing transfers, where accountId = this account)
 *   + SUM(incoming transfers, where toAccountId = this account)
 */
export async function applyTransactionsToBalances(
  balances: Record<string, number>,
  accountIds: string[],
): Promise<void> {
  if (accountIds.length === 0) return;

  // Income and expense grouped by accountId
  const txTotals = await db
    .select({
      accountId: transactions.accountId,
      type: transactions.type,
      total: sql<string>`cast(sum(${transactions.amount}) as text)`,
    })
    .from(transactions)
    .where(and(
      inArray(transactions.accountId, accountIds),
      eq(transactions.status, "completed"),
    ))
    .groupBy(transactions.accountId, transactions.type);

  for (const row of txTotals) {
    const amt = parseFloat(row.total);
    if (row.type === "income")   balances[row.accountId] = (balances[row.accountId] ?? 0) + amt;
    if (row.type === "expense")  balances[row.accountId] = (balances[row.accountId] ?? 0) - amt;
    if (row.type === "transfer") balances[row.accountId] = (balances[row.accountId] ?? 0) - amt; // outgoing debit
  }

  // Incoming transfers: credited to toAccountId
  const inTransfers = await db
    .select({
      toAccountId: transactions.toAccountId,
      total: sql<string>`cast(sum(${transactions.amount}) as text)`,
    })
    .from(transactions)
    .where(and(
      inArray(transactions.toAccountId, accountIds),
      eq(transactions.type, "transfer"),
      eq(transactions.status, "completed"),
      isNotNull(transactions.toAccountId),
    ))
    .groupBy(transactions.toAccountId);

  for (const row of inTransfers) {
    if (row.toAccountId) {
      balances[row.toAccountId] = (balances[row.toAccountId] ?? 0) + parseFloat(row.total);
    }
  }
}
