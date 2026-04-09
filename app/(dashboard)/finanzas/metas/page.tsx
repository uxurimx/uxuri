import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { savingsGoals, savingsContributions, objectives, businesses, businessMembers } from "@/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { SavingsGoalsList } from "@/components/finances/savings-goals-list";

export default async function MetasPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const [owned, member] = await Promise.all([
    db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, userId)),
    db.select({ businessId: businessMembers.businessId }).from(businessMembers).where(eq(businessMembers.userId, userId)),
  ]);
  const bizIds = [...new Set([...owned.map((b) => b.id), ...member.map((m) => m.businessId)])];

  // Fetch goals
  const goals = await db
    .select()
    .from(savingsGoals)
    .where(eq(savingsGoals.userId, userId))
    .orderBy(savingsGoals.isCompleted, savingsGoals.createdAt);

  // Compute saved amounts in one query
  let savedMap: Record<string, number> = {};
  if (goals.length > 0) {
    const goalIds = goals.map((g) => g.id);
    const sums = await db
      .select({
        goalId: savingsContributions.goalId,
        total:  sql<string>`cast(sum(${savingsContributions.amount}) as text)`,
      })
      .from(savingsContributions)
      .where(inArray(savingsContributions.goalId, goalIds))
      .groupBy(savingsContributions.goalId);
    for (const row of sums) savedMap[row.goalId] = parseFloat(row.total);
  }

  // Fetch objectives list for the link selector
  const userObjectives = await db
    .select({ id: objectives.id, title: objectives.title })
    .from(objectives)
    .where(eq(objectives.createdBy, userId))
    .orderBy(objectives.title);

  const goalsWithSaved = goals.map((g) => ({
    ...g,
    savedAmount: savedMap[g.id] ?? 0,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
  }));

  return (
    <SavingsGoalsList
      initialGoals={goalsWithSaved}
      objectives={userObjectives}
    />
  );
}
