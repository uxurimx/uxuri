import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { bills, accounts, businesses, businessMembers } from "@/db/schema";
import { eq, or, inArray } from "drizzle-orm";
import { BillsList } from "@/components/finances/bills-list";

export default async function PagosPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const [owned, member] = await Promise.all([
    db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, userId)),
    db.select({ businessId: businessMembers.businessId }).from(businessMembers).where(eq(businessMembers.userId, userId)),
  ]);
  const bizIds = [...new Set([...owned.map((b) => b.id), ...member.map((m) => m.businessId)])];

  const [userBills, userAccounts, allBusinesses] = await Promise.all([
    db.select().from(bills).where(eq(bills.userId, userId)).orderBy(bills.nextDueDate),

    db
      .select({ id: accounts.id, name: accounts.name, icon: accounts.icon, currency: accounts.currency })
      .from(accounts)
      .where(
        bizIds.length > 0
          ? or(eq(accounts.userId, userId), inArray(accounts.businessId, bizIds))!
          : eq(accounts.userId, userId)
      )
      .orderBy(accounts.name),

    bizIds.length > 0
      ? db
          .select({ id: businesses.id, name: businesses.name, logo: businesses.logo })
          .from(businesses)
          .where(inArray(businesses.id, bizIds))
      : Promise.resolve([] as { id: string; name: string; logo: string | null }[]),
  ]);

  return (
    <BillsList
      initialBills={userBills as never}
      accounts={userAccounts}
      businesses={allBusinesses}
    />
  );
}
