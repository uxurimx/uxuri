import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { habits, habitLogs } from "@/db/schema";
import { eq, and, gte } from "drizzle-orm";
import { HabitsClient, type HabitWithStats } from "@/components/habits/habits-client";

export const metadata = { title: "Hábitos — Uxuri" };

export default async function HabitsPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const todayStr = new Date().toISOString().split("T")[0];

  // Last 30 days for streak/heatmap
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

  const habitsWithStats: HabitWithStats[] = allHabits.map((habit) => {
    const logsForHabit = recentLogs.filter((l) => l.habitId === habit.id);
    const logDates = new Set(logsForHabit.map((l) => l.date));

    const doneToday = logDates.has(todayStr);

    const last7: { date: string; done: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split("T")[0];
      last7.push({ date: ds, done: logDates.has(ds) });
    }

    let streak = 0;
    const checkDate = new Date();
    while (streak < 30) {
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

  return (
    <div className="p-4 md:p-6">
      <HabitsClient initialHabits={habitsWithStats} todayStr={todayStr} />
    </div>
  );
}
