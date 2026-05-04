import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { transactions, accounts, businesses, businessMembers, bills } from "@/db/schema";
import { eq, or, inArray, and, gte, lte, desc, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { FinanceDashboard } from "@/components/finances/finance-dashboard";
import { applyTransactionsToBalances } from "@/lib/finance-balances";

async function getUserBizIds(userId: string) {
  const [owned, member] = await Promise.all([
    db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, userId)),
    db.select({ businessId: businessMembers.businessId }).from(businessMembers).where(eq(businessMembers.userId, userId)),
  ]);
  return [...new Set([...owned.map((b) => b.id), ...member.map((m) => m.businessId)])];
}

function pad(n: number) { return n.toString().padStart(2, "0"); }

function monthRange(date = new Date()) {
  const y = date.getFullYear(), m = date.getMonth() + 1;
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${pad(last)}` };
}

export default async function FinanzasPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const bizIds = await getUserBizIds(userId);

  const accountWhere =
    bizIds.length > 0
      ? or(eq(accounts.userId, userId), inArray(accounts.businessId, bizIds))
      : eq(accounts.userId, userId);

  const userAccounts = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      icon: accounts.icon,
      color: accounts.color,
      currency: accounts.currency,
      businessId: accounts.businessId,
      initialBalance: accounts.initialBalance,
    })
    .from(accounts)
    .where(accountWhere!)
    .orderBy(accounts.createdAt);

  const accountIds = userAccounts.map((a) => a.id);

  // ── Compute balances ───────────────────────────────────────────────────────

  const computedBalances: Record<string, number> = {};
  for (const acc of userAccounts) {
    computedBalances[acc.id] = parseFloat(acc.initialBalance ?? "0");
  }
  await applyTransactionsToBalances(computedBalances, accountIds);

  const dashAccounts = userAccounts.map((a) => ({
    id: a.id,
    name: a.name,
    icon: a.icon,
    color: a.color,
    currency: a.currency,
    businessId: a.businessId,
    computedBalance: computedBalances[a.id] ?? 0,
  }));

  // ── This month stats ───────────────────────────────────────────────────────

  const { start, end } = monthRange();
  const monthStats = { income: {} as Record<string, number>, expense: {} as Record<string, number> };

  if (accountIds.length > 0) {
    const totals = await db
      .select({
        type: transactions.type,
        currency: transactions.currency,
        total: sql<string>`cast(sum(${transactions.amount}) as text)`,
      })
      .from(transactions)
      .where(and(
        inArray(transactions.accountId, accountIds),
        eq(transactions.status, "completed"),
        gte(transactions.date, start),
        lte(transactions.date, end),
      ))
      .groupBy(transactions.type, transactions.currency);

    for (const row of totals) {
      const amt = parseFloat(row.total);
      if (row.type === "income")  monthStats.income[row.currency]  = (monthStats.income[row.currency]  ?? 0) + amt;
      if (row.type === "expense") monthStats.expense[row.currency] = (monthStats.expense[row.currency] ?? 0) + amt;
    }
  }

  // ── Cash flow: last 6 months (MXN) ─────────────────────────────────────────

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  const cfStart = `${sixMonthsAgo.getFullYear()}-${pad(sixMonthsAgo.getMonth() + 1)}-01`;

  const cashFlowRaw = accountIds.length > 0
    ? await db
        .select({
          month: sql<string>`to_char(${transactions.date}::date, 'YYYY-MM')`,
          type: transactions.type,
          total: sql<string>`cast(sum(${transactions.amount}) as text)`,
        })
        .from(transactions)
        .where(and(
          inArray(transactions.accountId, accountIds),
          eq(transactions.status, "completed"),
          eq(transactions.currency, "MXN"),
          gte(transactions.date, cfStart),
        ))
        .groupBy(sql`to_char(${transactions.date}::date, 'YYYY-MM')`, transactions.type)
        .orderBy(sql`to_char(${transactions.date}::date, 'YYYY-MM')`)
    : [];

  // Build last-6-months skeleton
  const cashFlow = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return { month: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, income: 0, expense: 0 };
  });
  for (const row of cashFlowRaw) {
    const slot = cashFlow.find((m) => m.month === row.month);
    if (!slot) continue;
    if (row.type === "income")  slot.income  = parseFloat(row.total);
    if (row.type === "expense") slot.expense = parseFloat(row.total);
  }

  // ── Upcoming bills (next 30 days) ──────────────────────────────────────────

  const today = new Date();
  const in30  = new Date(); in30.setDate(today.getDate() + 30);
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const in30Str  = `${in30.getFullYear()}-${pad(in30.getMonth() + 1)}-${pad(in30.getDate())}`;

  const billsWhere = bizIds.length > 0
    ? or(eq(bills.userId, userId), inArray(bills.businessId, bizIds))!
    : eq(bills.userId, userId);

  const upcomingBills = await db
    .select({
      id: bills.id,
      name: bills.name,
      amount: bills.amount,
      currency: bills.currency,
      nextDueDate: bills.nextDueDate,
      category: bills.category,
    })
    .from(bills)
    .where(and(
      billsWhere,
      eq(bills.isActive, true),
      lte(bills.nextDueDate, in30Str),
    ))
    .orderBy(bills.nextDueDate)
    .limit(6);

  // Also include overdue bills
  const overdueBills = await db
    .select({
      id: bills.id,
      name: bills.name,
      amount: bills.amount,
      currency: bills.currency,
      nextDueDate: bills.nextDueDate,
      category: bills.category,
    })
    .from(bills)
    .where(and(
      billsWhere,
      eq(bills.isActive, true),
      lte(bills.nextDueDate, todayStr),
    ))
    .orderBy(bills.nextDueDate)
    .limit(3);

  // Merge, deduplicate, sort
  const billMap = new Map<string, typeof upcomingBills[0]>();
  for (const b of [...overdueBills, ...upcomingBills]) billMap.set(b.id, b);
  const allUpcoming = [...billMap.values()]
    .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate))
    .slice(0, 6);

  // ── Recent transactions ────────────────────────────────────────────────────

  const toAccountsAlias = alias(accounts, "to_accounts");
  const recentTx = accountIds.length > 0
    ? await db
        .select({
          id: transactions.id,
          type: transactions.type,
          amount: transactions.amount,
          currency: transactions.currency,
          description: transactions.description,
          date: transactions.date,
          accountName: accounts.name,
          accountIcon: accounts.icon,
          toAccountName: toAccountsAlias.name,
          toAccountIcon: toAccountsAlias.icon,
        })
        .from(transactions)
        .leftJoin(accounts, eq(transactions.accountId, accounts.id))
        .leftJoin(toAccountsAlias, eq(transactions.toAccountId, toAccountsAlias.id))
        .where(or(
          inArray(transactions.accountId, accountIds),
          inArray(transactions.toAccountId, accountIds),
        )!)
        .orderBy(desc(transactions.date), desc(transactions.createdAt))
        .limit(8)
    : [];

  return (
    <FinanceDashboard
      accounts={dashAccounts}
      monthStats={monthStats}
      cashFlow={cashFlow}
      upcomingBills={allUpcoming as never}
      recentTx={recentTx as never}
    />
  );
}
