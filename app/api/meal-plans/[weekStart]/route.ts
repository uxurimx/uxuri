import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { mealPlans, mealEntries } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ensureUser } from "@/lib/ensure-user";

// GET: returns plan + entries for a given week (weekStart = YYYY-MM-DD)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ weekStart: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { weekStart } = await params;

  const [plan] = await db
    .select()
    .from(mealPlans)
    .where(and(eq(mealPlans.userId, userId), eq(mealPlans.weekStart, weekStart)));

  if (!plan) return NextResponse.json({ plan: null, entries: [] });

  const entries = await db
    .select()
    .from(mealEntries)
    .where(eq(mealEntries.planId, plan.id))
    .orderBy(mealEntries.dayOfWeek, mealEntries.mealTime);

  return NextResponse.json({ plan, entries });
}
