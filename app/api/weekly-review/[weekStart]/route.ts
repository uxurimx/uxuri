import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { weeklyReviews, tasks, timeSessions, habits, habitLogs, objectives } from "@/db/schema";
import { eq, and, gte, lt, ne, not, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const upsertSchema = z.object({
  workedWell: z.string().optional().nullable(),
  didntWork: z.string().optional().nullable(),
  biggestWin: z.string().optional().nullable(),
  mainLesson: z.string().optional().nullable(),
  nextWeekTop3: z.string().optional().nullable(),
  energyLevel: z.string().optional().nullable(),
  overallRating: z.string().optional().nullable(),
});

// GET: return review + auto-computed stats for the week
export async function GET(_req: Request, { params }: { params: Promise<{ weekStart: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { weekStart } = await params;
  const weekStartDate = new Date(weekStart + "T00:00:00");
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 7);
  const weekEndStr = weekEndDate.toISOString().split("T")[0];

  const [review, doneTasks, timeSessionRows, habitLogRows, activeObjs] = await Promise.all([
    db.select().from(weeklyReviews)
      .where(and(eq(weeklyReviews.userId, userId), eq(weeklyReviews.weekStart, weekStart)))
      .then((rows) => rows[0] ?? null),

    db.select({ id: tasks.id, title: tasks.title })
      .from(tasks)
      .where(and(
        eq(tasks.createdBy, userId),
        eq(tasks.status, "done"),
        gte(tasks.updatedAt, weekStartDate),
        lt(tasks.updatedAt, weekEndDate),
      )),

    db.select({ elapsedSeconds: timeSessions.elapsedSeconds })
      .from(timeSessions)
      .where(and(
        eq(timeSessions.userId, userId),
        gte(timeSessions.startedAt, weekStartDate),
        lt(timeSessions.startedAt, weekEndDate),
        ne(timeSessions.status, "running"),
      )),

    db.select({ habitId: habitLogs.habitId })
      .from(habitLogs)
      .where(and(
        eq(habitLogs.userId, userId),
        gte(habitLogs.date, weekStart),
        lt(habitLogs.date, weekEndStr),
      )),

    db.select({ id: objectives.id, title: objectives.title })
      .from(objectives)
      .where(and(eq(objectives.createdBy, userId), eq(objectives.status, "active")))
      .limit(5),
  ]);

  const weekSeconds = timeSessionRows.reduce((s, r) => s + r.elapsedSeconds, 0);

  return NextResponse.json({
    review,
    stats: {
      tasksDone: doneTasks.length,
      doneTasks: doneTasks.slice(0, 10),
      weekSeconds,
      habitCompletions: habitLogRows.length,
      activeObjectives: activeObjs.length,
    },
  });
}

export async function PUT(req: Request, { params }: { params: Promise<{ weekStart: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { weekStart } = await params;
  const body = await req.json();
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [existing] = await db.select({ id: weeklyReviews.id }).from(weeklyReviews)
    .where(and(eq(weeklyReviews.userId, userId), eq(weeklyReviews.weekStart, weekStart)));

  if (existing) {
    const [updated] = await db.update(weeklyReviews)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(weeklyReviews.userId, userId), eq(weeklyReviews.weekStart, weekStart)))
      .returning();
    return NextResponse.json(updated);
  } else {
    const [created] = await db.insert(weeklyReviews)
      .values({ userId, weekStart, ...parsed.data }).returning();
    return NextResponse.json(created, { status: 201 });
  }
}
