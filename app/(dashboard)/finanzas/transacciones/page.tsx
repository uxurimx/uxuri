import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { transactions, accounts, businesses, businessMembers, clients, projects } from "@/db/schema";
import { eq, or, inArray, and, gte, lte, desc, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { TransactionsList } from "@/components/finances/transactions-list";

async function getUserBizIds(userId: string) {
  const [owned, member] = await Promise.all([
    db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, userId)),
    db.select({ businessId: businessMembers.businessId }).from(businessMembers).where(eq(businessMembers.userId, userId)),
  ]);
  return [...new Set([...owned.map((b) => b.id), ...member.map((m) => m.businessId)])];
}

function monthRange(date = new Date()) {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return {
    start: `${y}-${m}-01`,
    end: `${y}-${m}-${lastDay.toString().padStart(2, "0")}`,
  };
}

export default async function TransaccionesPage({
  searchParams,
}: {
  searchParams: Promise<{ accountId?: string }>;
}) {
  const { userId } = await auth();
  const { accountId: initialAccountId = "" } = await searchParams;
  if (!userId) return null;

  const bizIds = await getUserBizIds(userId);

  const accountWhere =
    bizIds.length > 0
      ? or(eq(accounts.userId, userId), inArray(accounts.businessId, bizIds))
      : eq(accounts.userId, userId);

  // Selectors
  const [userAccounts, allBusinesses, userClients, userProjects] = await Promise.all([
    db
      .select({ id: accounts.id, name: accounts.name, icon: accounts.icon, currency: accounts.currency, businessId: accounts.businessId, type: accounts.type })
      .from(accounts)
      .where(accountWhere!)
      .orderBy(accounts.name),

    bizIds.length > 0
      ? db.select({ id: businesses.id, name: businesses.name, logo: businesses.logo }).from(businesses).where(inArray(businesses.id, bizIds))
      : Promise.resolve([] as { id: string; name: string; logo: string | null }[]),

    db.select({ id: clients.id, name: clients.name }).from(clients).where(eq(clients.userId, userId)).orderBy(clients.name),
    db.select({ id: projects.id, name: projects.name }).from(projects).where(eq(projects.createdBy, userId)).orderBy(projects.name),
  ]);

  const accountIds = userAccounts.map((a) => a.id);
  const { start, end } = monthRange();

  const toAccounts = alias(accounts, "to_accounts");
  const baseTxCondition = or(
    inArray(transactions.accountId, accountIds),
    inArray(transactions.toAccountId, accountIds),
  )!;

  const [initialTx, totals] = accountIds.length > 0
    ? await Promise.all([
        db
          .select({
            id: transactions.id,
            userId: transactions.userId,
            accountId: transactions.accountId,
            toAccountId: transactions.toAccountId,
            businessId: transactions.businessId,
            clientId: transactions.clientId,
            projectId: transactions.projectId,
            type: transactions.type,
            amount: transactions.amount,
            toAmount: transactions.toAmount,
            currency: transactions.currency,
            exchangeRateMXN: transactions.exchangeRateMXN,
            category: transactions.category,
            description: transactions.description,
            date: transactions.date,
            status: transactions.status,
            notes: transactions.notes,
            createdAt: transactions.createdAt,
            updatedAt: transactions.updatedAt,
            accountName: accounts.name,
            accountIcon: accounts.icon,
            toAccountName: toAccounts.name,
            toAccountIcon: toAccounts.icon,
            clientName: clients.name,
            projectName: projects.name,
          })
          .from(transactions)
          .leftJoin(accounts, eq(transactions.accountId, accounts.id))
          .leftJoin(toAccounts, eq(transactions.toAccountId, toAccounts.id))
          .leftJoin(clients, eq(transactions.clientId, clients.id))
          .leftJoin(projects, eq(transactions.projectId, projects.id))
          .where(and(
            baseTxCondition,
            gte(transactions.date, start),
            lte(transactions.date, end),
          ))
          .orderBy(desc(transactions.date), desc(transactions.createdAt))
          .limit(100),

        db
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
          .groupBy(transactions.type, transactions.currency),
      ])
    : [[], []];

  const income: Record<string, number> = {};
  const expense: Record<string, number> = {};
  for (const row of totals) {
    const amount = parseFloat(row.total);
    if (row.type === "income")  income[row.currency]  = (income[row.currency]  ?? 0) + amount;
    if (row.type === "expense") expense[row.currency] = (expense[row.currency] ?? 0) + amount;
  }

  return (
    <TransactionsList
      initialTransactions={initialTx as never}
      initialStats={{ income, expense }}
      accounts={userAccounts}
      clients={userClients}
      projects={userProjects}
      businesses={allBusinesses}
      currentUserId={userId}
      initialAccountId={initialAccountId}
    />
  );
}
