import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { habits, habitLogs } from "@/db/schema";
import { eq, and, gte, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { todayStr, daysAgoStr } from "@/lib/date";

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
  const dateParam = searchParams.get("date") ?? todayStr();
  const thirtyStr = daysAgoStr(30);

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

    const last7: { date: string; done: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const ds = daysAgoStr(i);
      last7.push({ date: ds, done: logDates.has(ds) });
    }

    let streak = 0;
    while (streak < 30) {
      const ds = daysAgoStr(streak);
      if (logDates.has(ds)) streak++;
      else break;
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
