import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { accounts, businesses, businessMembers } from "@/db/schema";
import { eq, or, inArray } from "drizzle-orm";
import { AccountsList } from "@/components/finances/accounts-list";

export default async function FinanzasPage() {
  const { userId } = await auth();
  if (!userId) return null;

  // Businesses this user belongs to
  const [owned, member] = await Promise.all([
    db.select({ id: businesses.id, name: businesses.name }).from(businesses).where(eq(businesses.ownerId, userId)),
    db
      .select({ businessId: businessMembers.businessId })
      .from(businessMembers)
      .where(eq(businessMembers.userId, userId)),
  ]);

  const bizIds = [...new Set([...owned.map((b) => b.id), ...member.map((m) => m.businessId)])];

  // Fetch all businesses with name (for display in cards)
  const allBizNames =
    bizIds.length > 0
      ? await db
          .select({ id: businesses.id, name: businesses.name, logo: businesses.logo, color: businesses.color })
          .from(businesses)
          .where(inArray(businesses.id, bizIds))
      : [];

  // Fetch accounts (personal + business)
  const whereClause =
    bizIds.length > 0
      ? or(eq(accounts.userId, userId), inArray(accounts.businessId, bizIds))
      : eq(accounts.userId, userId);

  const userAccounts = await db
    .select()
    .from(accounts)
    .where(whereClause!)
    .orderBy(accounts.createdAt);

  return (
    <AccountsList
      initialAccounts={userAccounts}
      businesses={allBizNames}
      currentUserId={userId}
    />
  );
}
