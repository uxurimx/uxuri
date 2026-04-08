import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { transactions, accounts, businesses, businessMembers } from "@/db/schema";
import { eq, or, inArray, and, sql } from "drizzle-orm";
import { AccountsList } from "@/components/finances/accounts-list";

export default async function FinanzasPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const [owned, member] = await Promise.all([
    db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, userId)),
    db.select({ businessId: businessMembers.businessId }).from(businessMembers).where(eq(businessMembers.userId, userId)),
  ]);

  const bizIds = [...new Set([...owned.map((b) => b.id), ...member.map((m) => m.businessId)])];

  const allBizNames =
    bizIds.length > 0
      ? await db
          .select({ id: businesses.id, name: businesses.name, logo: businesses.logo, color: businesses.color })
          .from(businesses)
          .where(inArray(businesses.id, bizIds))
      : [];

  const whereClause =
    bizIds.length > 0
      ? or(eq(accounts.userId, userId), inArray(accounts.businessId, bizIds))
      : eq(accounts.userId, userId);

  const userAccounts = await db
    .select()
    .from(accounts)
    .where(whereClause!)
    .orderBy(accounts.createdAt);

  const accountIds = userAccounts.map((a) => a.id);

  // Compute real balances: initialBalance + sum(income) - sum(expense) per account
  const computedBalances: Record<string, number> = {};
  for (const acc of userAccounts) {
    computedBalances[acc.id] = parseFloat(acc.initialBalance ?? "0");
  }

  if (accountIds.length > 0) {
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
      const amount = parseFloat(row.total);
      if (row.type === "income")  computedBalances[row.accountId] = (computedBalances[row.accountId] ?? 0) + amount;
      if (row.type === "expense") computedBalances[row.accountId] = (computedBalances[row.accountId] ?? 0) - amount;
    }
  }

  return (
    <AccountsList
      initialAccounts={userAccounts}
      businesses={allBizNames}
      currentUserId={userId}
      computedBalances={computedBalances}
    />
  );
}
