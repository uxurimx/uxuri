import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { timeBlocks, tasks, projects } from "@/db/schema";
import { eq, and, or, ne, gte, lte } from "drizzle-orm";
import { ScheduleClient } from "@/components/schedule/schedule-client";
import { todayStr as getTodayStr } from "@/lib/date";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agenda — Uxuri" };

type View = "day" | "week" | "month" | "year";

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0];
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

interface Props {
  searchParams: Promise<{ date?: string; view?: string }>;
}

export default async function SchedulePage({ searchParams }: Props) {
  const { userId } = await auth();
  if (!userId) return null;

  const todayStr = getTodayStr();
  const { date, view = "day" } = await searchParams;
  const dateStr = date ?? todayStr;
  const safeView: View = ["day", "week", "month", "year"].includes(view as View) ? (view as View) : "day";

  let startDate = dateStr;
  let endDate = dateStr;

  if (safeView === "week") {
    startDate = getWeekStart(dateStr);
    endDate = addDays(startDate, 6);
  } else if (safeView === "month") {
    const [y, m] = dateStr.split("-").map(Number);
    startDate = `${y}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    endDate = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  } else if (safeView === "year") {
    const y = dateStr.slice(0, 4);
    startDate = `${y}-01-01`;
    endDate = `${y}-12-31`;
  }

  const [blocks, pendingTasks] = await Promise.all([
    db.select().from(timeBlocks)
      .where(and(
        eq(timeBlocks.userId, userId),
        gte(timeBlocks.date, startDate),
        lte(timeBlocks.date, endDate),
      ))
      .orderBy(timeBlocks.date, timeBlocks.startMinutes),

    db.select({ id: tasks.id, title: tasks.title, projectName: projects.name })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(and(
        or(eq(tasks.createdBy, userId), eq(tasks.assignedTo, userId)),
        ne(tasks.status, "done"),
      ))
      .orderBy(tasks.createdAt)
      .limit(50),
  ]);

  const blocksByDate: Record<string, typeof blocks> = {};
  for (const b of blocks) {
    if (!blocksByDate[b.date]) blocksByDate[b.date] = [];
    blocksByDate[b.date].push(b);
  }

  return (
    <div className="p-4 md:p-6">
      <ScheduleClient
        initialBlocks={blocksByDate[dateStr] ?? []}
        blocksByDate={blocksByDate}
        dateStr={dateStr}
        todayStr={todayStr}
        tasks={pendingTasks.map((t) => ({ id: t.id, title: t.title, projectName: t.projectName ?? null }))}
        view={safeView}
      />
    </div>
  );
}
