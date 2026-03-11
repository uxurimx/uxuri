import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { weeklyReviews, tasks, timeSessions, habitLogs, objectives } from "@/db/schema";
import { eq, and, gte, lt, ne } from "drizzle-orm";
import { WeeklyReviewClient } from "@/components/review/weekly-review-client";

export const metadata = { title: "Revisión semanal — Uxuri" };

function getWeekStart(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr + "T12:00:00") : new Date();
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return d.toISOString().split("T")[0];
}

interface Props {
  searchParams: Promise<{ week?: string }>;
}

export default async function ReviewPage({ searchParams }: Props) {
  const { userId } = await auth();
  if (!userId) return null;

  const { week } = await searchParams;
  const weekStart = week ? getWeekStart(week) : getWeekStart();
  const weekStartDate = new Date(weekStart + "T00:00:00");
  const weekEndDate = new Date(weekStart + "T00:00:00");
  weekEndDate.setDate(weekEndDate.getDate() + 7);
  const weekEndStr = weekEndDate.toISOString().split("T")[0];

  const [reviewRow, doneTasks, timeSessionRows, habitLogRows, activeObjs] = await Promise.all([
    db.select().from(weeklyReviews)
      .where(and(eq(weeklyReviews.userId, userId), eq(weeklyReviews.weekStart, weekStart)))
      .then((r) => r[0] ?? null),

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

    db.select({ id: objectives.id })
      .from(objectives)
      .where(and(eq(objectives.createdBy, userId), eq(objectives.status, "active"))),
  ]);

  const stats = {
    tasksDone: doneTasks.length,
    doneTasks: doneTasks.slice(0, 10),
    weekSeconds: timeSessionRows.reduce((s, r) => s + r.elapsedSeconds, 0),
    habitCompletions: habitLogRows.length,
    activeObjectives: activeObjs.length,
  };

  return (
    <div className="p-4 md:p-6">
      <WeeklyReviewClient
        weekStart={weekStart}
        stats={stats}
        initialReview={reviewRow ? {
          workedWell: reviewRow.workedWell,
          didntWork: reviewRow.didntWork,
          biggestWin: reviewRow.biggestWin,
          mainLesson: reviewRow.mainLesson,
          nextWeekTop3: reviewRow.nextWeekTop3,
          energyLevel: reviewRow.energyLevel,
          overallRating: reviewRow.overallRating,
        } : null}
      />
    </div>
  );
}
