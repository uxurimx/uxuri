import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { budgets, transactions, accounts, businesses, businessMembers } from "@/db/schema";
import { eq, or, inArray, and, gte, lte, sql } from "drizzle-orm";
import { BudgetsList } from "@/components/finances/budgets-list";

function pad(n: number) { return n.toString().padStart(2, "0"); }

function currentMonthRange() {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth() + 1;
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return {
    start: `${y}-${pad(m)}-01`,
    end:   `${y}-${pad(m)}-${pad(last)}`,
    label: now.toLocaleDateString("es-MX", { month: "long", year: "numeric" }),
  };
}

export default async function PresupuestoPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const [owned, member] = await Promise.all([
    db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, userId)),
    db.select({ businessId: businessMembers.businessId }).from(businessMembers).where(eq(businessMembers.userId, userId)),
  ]);
  const bizIds = [...new Set([...owned.map((b) => b.id), ...member.map((m) => m.businessId)])];

  const [userBudgets, allBusinesses] = await Promise.all([
    db.select().from(budgets).where(eq(budgets.userId, userId)).orderBy(budgets.category),
    bizIds.length > 0
      ? db.select({ id: businesses.id, name: businesses.name, logo: businesses.logo })
          .from(businesses).where(inArray(businesses.id, bizIds))
      : Promise.resolve([] as { id: string; name: string; logo: string | null }[]),
  ]);

  if (userBudgets.length === 0) {
    const { label } = currentMonthRange();
    return (
      <BudgetsList
        initialBudgets={[]}
        businesses={allBusinesses}
        periodLabel={label}
      />
    );
  }

  // Get user's account IDs to filter transactions
  const accountWhere =
    bizIds.length > 0
      ? or(eq(accounts.userId, userId), inArray(accounts.businessId, bizIds))
      : eq(accounts.userId, userId);

  const userAccounts = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(accountWhere!);

  const accountIds = userAccounts.map((a) => a.id);
  const { start, end, label } = currentMonthRange();

  // Single query: spending by category for this month
  const spendingByCat = accountIds.length > 0
    ? await db
        .select({
          category: transactions.category,
          currency: transactions.currency,
          total: sql<string>`cast(sum(${transactions.amount}) as text)`,
        })
        .from(transactions)
        .where(and(
          inArray(transactions.accountId, accountIds),
          eq(transactions.type, "expense"),
          eq(transactions.status, "completed"),
          gte(transactions.date, start),
          lte(transactions.date, end),
        ))
        .groupBy(transactions.category, transactions.currency)
    : [];

  // Build lookup: category -> spent amount (same currency)
  const spentMap: Record<string, number> = {};
  for (const row of spendingByCat) {
    const key = `${row.category ?? ""}__${row.currency}`;
    spentMap[key] = (spentMap[key] ?? 0) + parseFloat(row.total);
  }

  // Attach spent to each budget
  const budgetsWithSpent = userBudgets.map((b) => ({
    ...b,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
    spent: spentMap[`${b.category}__${b.currency}`] ?? 0,
  }));

  return (
    <BudgetsList
      initialBudgets={budgetsWithSpent}
      businesses={allBusinesses}
      periodLabel={label}
    />
  );
}
