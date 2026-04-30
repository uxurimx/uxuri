import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { habits, habitLogs } from "@/db/schema";
import { eq, and, gte } from "drizzle-orm";
import { HabitsClient, type HabitWithStats } from "@/components/habits/habits-client";
import { todayStr as getTodayStr, daysAgoStr, localDateStr } from "@/lib/date";

export const metadata = { title: "Hábitos — Uxuri" };

export default async function HabitsPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const todayStr = getTodayStr();
  const thirtyStr = daysAgoStr(30);

  const [allHabits, recentLogs] = await Promise.all([
    db.select().from(habits)
      .where(and(eq(habits.userId, userId), eq(habits.isActive, true)))
      .orderBy(habits.sortOrder, habits.createdAt),
    db.select().from(habitLogs)
      .where(and(eq(habitLogs.userId, userId), gte(habitLogs.date, thirtyStr))),
  ]);

  const habitsWithStats: HabitWithStats[] = allHabits.map((habit) => {
    const logsForHabit = recentLogs.filter((l) => l.habitId === habit.id);
    const logDates = new Set(logsForHabit.map((l) => l.date));

    const doneToday = logDates.has(todayStr);

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

  return (
    <div className="p-4 md:p-6">
      <HabitsClient initialHabits={habitsWithStats} todayStr={todayStr} />
    </div>
  );
}
