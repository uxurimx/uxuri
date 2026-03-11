import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { habits, habitLogs } from "@/db/schema";
import { eq, and, gte, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  frequency: z.enum(["daily", "weekdays", "weekends", "weekly"]).optional(),
  targetDays: z.number().int().min(1).max(7).optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

// Returns all active habits with today's log status + last 7 days logs + streak
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date") ?? new Date().toISOString().split("T")[0];

  // Last 30 days for streak computation
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyStr = thirtyDaysAgo.toISOString().split("T")[0];

  const [allHabits, recentLogs] = await Promise.all([
    db.select().from(habits)
      .where(and(eq(habits.userId, userId), eq(habits.isActive, true)))
      .orderBy(habits.sortOrder, habits.createdAt),
    db.select().from(habitLogs)
      .where(and(eq(habitLogs.userId, userId), gte(habitLogs.date, thirtyStr))),
  ]);

  const result = allHabits.map((habit) => {
    const logsForHabit = recentLogs.filter((l) => l.habitId === habit.id);
    const logDates = new Set(logsForHabit.map((l) => l.date));

    // Today's status
    const doneToday = logDates.has(dateParam);

    // Last 7 days for mini heatmap
    const last7: { date: string; done: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split("T")[0];
      last7.push({ date: ds, done: logDates.has(ds) });
    }

    // Streak: count consecutive days going backward from today
    let streak = 0;
    let checkDate = new Date();
    while (true) {
      const ds = checkDate.toISOString().split("T")[0];
      if (logDates.has(ds)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return { ...habit, doneToday, last7, streak };
  });

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [habit] = await db.insert(habits).values({
    userId,
    ...parsed.data,
  }).returning();

  return NextResponse.json(habit, { status: 201 });
}
