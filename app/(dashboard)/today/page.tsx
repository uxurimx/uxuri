import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import {
  tasks, projects, users, objectives,
  objectiveMilestones, objectiveProjects, objectiveTasks, dailyFocus, timeSessions, habits, habitLogs,
} from "@/db/schema";
import { eq, and, or, lt, not, sql, gte, ne } from "drizzle-orm";
import { TodayClient } from "@/components/today/today-client";
import { todayStr as getTodayStr, startOfLocalDay, startOfLocalWeek } from "@/lib/date";

export const metadata = { title: "Hoy — Uxuri" };

export default async function TodayPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const today = getTodayStr();

  const formatted = new Intl.DateTimeFormat("es-ES", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    timeZone: process.env.APP_TIMEZONE,
  }).format(new Date());

  const [
    [userRow],
    focusRows,
    dueTodayRows,
    overdueRows,
    activeObjectivesRaw,
    allMilestonesRaw,
    linkedProjectsRaw,
    linkedTasksRaw,
    todayHabits,
    todayHabitLogs,
  ] = await Promise.all([

    db.select({ name: users.name }).from(users).where(eq(users.id, userId)),

    // Daily focus tasks with task + project info
    db
      .select({
        focusId: dailyFocus.id,
        taskId: tasks.id,
        sortOrder: dailyFocus.sortOrder,
        title: tasks.title,
        status: tasks.status,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
        projectName: projects.name,
      })
      .from(dailyFocus)
      .innerJoin(tasks, eq(dailyFocus.taskId, tasks.id))
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(and(eq(dailyFocus.userId, userId), eq(dailyFocus.date, today)))
      .orderBy(dailyFocus.sortOrder, dailyFocus.createdAt),

    // Tasks due today (not done, mine)
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
        projectName: projects.name,
      })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(
        and(
          or(eq(tasks.createdBy, userId), eq(tasks.assignedTo, userId)),
          eq(tasks.dueDate, today),
          not(sql`${tasks.status} = 'done'`),
        )
      )
      .orderBy(
        sql`CASE ${tasks.priority} WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END`,
      ),

    // Overdue tasks (not done, mine)
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
        projectName: projects.name,
      })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(
        and(
          or(eq(tasks.createdBy, userId), eq(tasks.assignedTo, userId)),
          lt(tasks.dueDate, today),
          not(sql`${tasks.status} = 'done'`),
        )
      )
      .orderBy(tasks.dueDate)
      .limit(20),

    // Active objectives
    db.select().from(objectives).where(
      and(eq(objectives.status, "active"), eq(objectives.createdBy, userId))
    ).limit(8),

    db.select().from(objectiveMilestones),
    db.select({ objectiveId: objectiveProjects.objectiveId, status: projects.status })
      .from(objectiveProjects)
      .leftJoin(projects, eq(objectiveProjects.projectId, projects.id)),
    db.select({ objectiveId: objectiveTasks.objectiveId, status: tasks.status })
      .from(objectiveTasks)
      .leftJoin(tasks, eq(objectiveTasks.taskId, tasks.id)),

    // Habits for today
    db.select().from(habits)
      .where(and(eq(habits.userId, userId), eq(habits.isActive, true)))
      .orderBy(habits.sortOrder, habits.createdAt),

    db.select().from(habitLogs)
      .where(and(eq(habitLogs.userId, userId), eq(habitLogs.date, today))),
  ]);

  // Time stats — usando zona horaria local
  const todayStart = startOfLocalDay();
  const todayEnd = new Date(todayStart.getTime() + 24 * 3600 * 1000 - 1);
  const weekStart = startOfLocalWeek();

  const [todaySessionRows, weekSessionRows] = await Promise.all([
    db.select({ elapsedSeconds: timeSessions.elapsedSeconds })
      .from(timeSessions)
      .where(and(
        eq(timeSessions.userId, userId),
        gte(timeSessions.startedAt, todayStart),
        ne(timeSessions.status, "running"),
      )),
    db.select({ elapsedSeconds: timeSessions.elapsedSeconds })
      .from(timeSessions)
      .where(and(
        eq(timeSessions.userId, userId),
        gte(timeSessions.startedAt, weekStart),
        ne(timeSessions.status, "running"),
      )),
  ]);

  const timeStats = {
    todaySeconds: todaySessionRows.reduce((s, r) => s + r.elapsedSeconds, 0),
    weekSeconds: weekSessionRows.reduce((s, r) => s + r.elapsedSeconds, 0),
    todaySessions: todaySessionRows.length,
    weekSessions: weekSessionRows.length,
  };

  // Today's habits with done status
  const doneTodayIds = new Set(todayHabitLogs.map((l) => l.habitId));
  const todayHabitsWithStatus = todayHabits.map((h) => ({
    id: h.id,
    title: h.title,
    icon: h.icon,
    color: h.color,
    doneToday: doneTodayIds.has(h.id),
  }));

  // Calculate objective progress
  const activeObjectives = activeObjectivesRaw.map((obj) => {
    const mils = allMilestonesRaw.filter((m) => m.objectiveId === obj.id);
    const mProgress = mils.length > 0 ? Math.round((mils.filter((m) => m.done).length / mils.length) * 100) : null;
    const pRows = linkedProjectsRaw.filter((p) => p.objectiveId === obj.id);
    const pProgress = pRows.length > 0 ? Math.round((pRows.filter((p) => p.status === "completed").length / pRows.length) * 100) : null;
    const tRows = linkedTasksRaw.filter((t) => t.objectiveId === obj.id);
    const tProgress = tRows.length > 0 ? Math.round((tRows.filter((t) => t.status === "done").length / tRows.length) * 100) : null;
    const parts = [mProgress, pProgress, tProgress].filter((v): v is number => v !== null);
    const overallProgress = parts.length > 0 ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : 0;
    return { id: obj.id, title: obj.title, priority: obj.priority, overallProgress };
  });

  return (
    <TodayClient
      userName={userRow?.name ?? ""}
      todayStr={today}
      formattedDate={formatted}
      focusTasks={focusRows}
      dueTodayTasks={dueTodayRows}
      overdueTasks={overdueRows}
      activeObjectives={activeObjectives}
      timeStats={timeStats}
      todayHabits={todayHabitsWithStatus}
    />
  );
}
