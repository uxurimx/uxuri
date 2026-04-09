import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { mealPlans, mealEntries } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { MealPlanner } from "@/components/meals/meal-planner";

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

  const weekStart = getMondayISO();

  // Fetch this week's plan + entries
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

  return (
    <MealPlanner
      initialEntries={initialEntries.map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
      }))}
      initialWeekStart={weekStart}
    />
  );
}
