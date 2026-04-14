import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import {
  mealPlans, mealEntries,
  shoppingLists, shoppingItems,
  businesses, businessMembers,
} from "@/db/schema";
import { and, eq, or, inArray, desc, sql } from "drizzle-orm";
import { MealsContainer } from "@/components/meals/meals-container";

function getMondayISO(date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default async function ComidasPage() {
  const { userId } = await auth();
  if (!userId) return null;

  // User's businesses (for sharing)
  const [owned, member] = await Promise.all([
    db.select({ id: businesses.id, name: businesses.name, logo: businesses.logo })
      .from(businesses).where(eq(businesses.ownerId, userId)),
    db.select({ businessId: businessMembers.businessId })
      .from(businessMembers).where(eq(businessMembers.userId, userId)),
  ]);
  const memberIds = member.map((m) => m.businessId);
  const memberBizs = memberIds.length > 0
    ? await db.select({ id: businesses.id, name: businesses.name, logo: businesses.logo })
        .from(businesses).where(inArray(businesses.id, memberIds))
    : [];
  const userBusinesses = [
    ...owned,
    ...memberBizs.filter((b) => !owned.find((o) => o.id === b.id)),
  ];
  const bizIds = userBusinesses.map((b) => b.id);

  // ── Meal planner ───────────────────────────────────────────────────────────
  const weekStart = getMondayISO();

  const [plan] = await db
    .select()
    .from(mealPlans)
    .where(and(eq(mealPlans.userId, userId), eq(mealPlans.weekStart, weekStart)));

  const initialEntries = plan
    ? await db
        .select()
        .from(mealEntries)
        .where(eq(mealEntries.planId, plan.id))
        .orderBy(mealEntries.dayOfWeek, mealEntries.mealTime)
    : [];

  // ── Shopping lists ─────────────────────────────────────────────────────────
  const listsWhere = bizIds.length > 0
    ? or(eq(shoppingLists.userId, userId), inArray(shoppingLists.businessId, bizIds))!
    : eq(shoppingLists.userId, userId);

  const rawLists = await db
    .select({
      id:         shoppingLists.id,
      userId:     shoppingLists.userId,
      businessId: shoppingLists.businessId,
      name:       shoppingLists.name,
      weekStart:  shoppingLists.weekStart,
      status:     shoppingLists.status,
      notes:      shoppingLists.notes,
      createdAt:  shoppingLists.createdAt,
      updatedAt:  shoppingLists.updatedAt,
      itemCount:  sql<number>`(SELECT COUNT(*)::int FROM shopping_items WHERE list_id = ${shoppingLists.id})`,
      doneCount:  sql<number>`(SELECT COUNT(*)::int FROM shopping_items WHERE list_id = ${shoppingLists.id} AND is_done = true)`,
    })
    .from(shoppingLists)
    .where(listsWhere)
    .orderBy(desc(shoppingLists.updatedAt));

  return (
    <MealsContainer
      initialEntries={initialEntries.map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
      }))}
      initialWeekStart={weekStart}
      initialLists={rawLists.map((l) => ({
        ...l,
        createdAt: l.createdAt.toISOString(),
        updatedAt: l.updatedAt.toISOString(),
      }))}
      businesses={userBusinesses}
    />
  );
}
