import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { transactions, accounts, businesses, businessMembers } from "@/db/schema";
import { eq, or, inArray, and, gte, lte, isNotNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("startDate");
  const endDate   = searchParams.get("endDate");

  // Get account IDs accessible to user
  const [owned, member] = await Promise.all([
    db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, userId)),
    db.select({ businessId: businessMembers.businessId }).from(businessMembers).where(eq(businessMembers.userId, userId)),
  ]);
  const bizIds = [...new Set([...owned.map((b) => b.id), ...member.map((m) => m.businessId)])];
  const userAccs = await db.select({ id: accounts.id, initialBalance: accounts.initialBalance }).from(accounts).where(
    bizIds.length > 0
      ? or(eq(accounts.userId, userId), inArray(accounts.businessId, bizIds))
      : eq(accounts.userId, userId)
  );
  const accountIds = userAccs.map((a) => a.id);
  if (accountIds.length === 0) return NextResponse.json({ income: {}, expense: {}, balances: {} });

  const dateConditions = [];
  if (startDate) dateConditions.push(gte(transactions.date, startDate));
  if (endDate)   dateConditions.push(lte(transactions.date, endDate));

  // Totals grouped by type + currency (for the period)
  const totals = await db
    .select({
      type:     transactions.type,
      currency: transactions.currency,
      total:    sql<string>`cast(sum(${transactions.amount}) as text)`,
    })
    .from(transactions)
    .where(and(
      inArray(transactions.accountId, accountIds),
      eq(transactions.status, "completed"),
      ...dateConditions,
    ))
    .groupBy(transactions.type, transactions.currency);

  const income:  Record<string, number> = {};
  const expense: Record<string, number> = {};

  for (const row of totals) {
    const amount = parseFloat(row.total);
    if (row.type === "income")  income[row.currency]  = (income[row.currency]  ?? 0) + amount;
    if (row.type === "expense") expense[row.currency] = (expense[row.currency] ?? 0) + amount;
  }

  // ── Balance per account (all-time, ignoring period filters) ──────────────────
  // initialBalance + income - expense - outgoing transfers + incoming transfers

  const balances: Record<string, number> = {};
  for (const acc of userAccs) {
    balances[acc.id] = parseFloat(acc.initialBalance ?? "0");
  }

  // Income and expense (all time)
  const allTx = await db
    .select({
      accountId: transactions.accountId,
      type:      transactions.type,
      total:     sql<string>`cast(sum(${transactions.amount}) as text)`,
    })
    .from(transactions)
    .where(and(inArray(transactions.accountId, accountIds), eq(transactions.status, "completed")))
    .groupBy(transactions.accountId, transactions.type);

  for (const row of allTx) {
    const amt = parseFloat(row.total);
    if (row.type === "income")   balances[row.accountId] = (balances[row.accountId] ?? 0) + amt;
    if (row.type === "expense")  balances[row.accountId] = (balances[row.accountId] ?? 0) - amt;
    if (row.type === "transfer") balances[row.accountId] = (balances[row.accountId] ?? 0) - amt; // outgoing debit
  }

  // Incoming transfers (credit to toAccountId)
  const inTransfers = await db
    .select({
      toAccountId: transactions.toAccountId,
      total:       sql<string>`cast(sum(${transactions.amount}) as text)`,
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

  return NextResponse.json({ income, expense, balances });
}
