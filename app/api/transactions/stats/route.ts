import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { transactions, accounts, businesses, businessMembers } from "@/db/schema";
import { eq, or, inArray, and, gte, lte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  // Get account IDs accessible to user
  const [owned, member] = await Promise.all([
    db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, userId)),
    db.select({ businessId: businessMembers.businessId }).from(businessMembers).where(eq(businessMembers.userId, userId)),
  ]);
  const bizIds = [...new Set([...owned.map((b) => b.id), ...member.map((m) => m.businessId)])];
  const userAccs = await db.select({ id: accounts.id }).from(accounts).where(
    bizIds.length > 0
      ? or(eq(accounts.userId, userId), inArray(accounts.businessId, bizIds))
      : eq(accounts.userId, userId)
  );
  const accountIds = userAccs.map((a) => a.id);
  if (accountIds.length === 0) return NextResponse.json({ income: {}, expense: {}, balances: {} });

  const conditions = [
    inArray(transactions.accountId, accountIds),
    eq(transactions.status, "completed"),
  ];
  if (startDate) conditions.push(gte(transactions.date, startDate));
  if (endDate) conditions.push(lte(transactions.date, endDate));

  // Totals grouped by type + currency
  const totals = await db
    .select({
      type: transactions.type,
      currency: transactions.currency,
      total: sql<string>`cast(sum(${transactions.amount}) as text)`,
    })
    .from(transactions)
    .where(and(...conditions))
    .groupBy(transactions.type, transactions.currency);

  const income: Record<string, number> = {};
  const expense: Record<string, number> = {};

  for (const row of totals) {
    const amount = parseFloat(row.total);
    if (row.type === "income") income[row.currency] = (income[row.currency] ?? 0) + amount;
    if (row.type === "expense") expense[row.currency] = (expense[row.currency] ?? 0) + amount;
  }

  // Balance per account (initialBalance + transactions)
  const txByAccount = await db
    .select({
      accountId: transactions.accountId,
      type: transactions.type,
      total: sql<string>`cast(sum(${transactions.amount}) as text)`,
    })
    .from(transactions)
    .where(and(inArray(transactions.accountId, accountIds), eq(transactions.status, "completed")))
    .groupBy(transactions.accountId, transactions.type);

  const balances: Record<string, number> = {};
  for (const acc of userAccs) {
    const [accRow] = await db.select({ initialBalance: accounts.initialBalance }).from(accounts).where(eq(accounts.id, acc.id));
    balances[acc.id] = parseFloat(accRow?.initialBalance ?? "0");
  }
  for (const row of txByAccount) {
    const amount = parseFloat(row.total);
    if (row.type === "income") balances[row.accountId] = (balances[row.accountId] ?? 0) + amount;
    if (row.type === "expense") balances[row.accountId] = (balances[row.accountId] ?? 0) - amount;
  }

  return NextResponse.json({ income, expense, balances });
}
