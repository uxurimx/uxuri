import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { timeBlocks, tasks, projects } from "@/db/schema";
import { eq, and, or, ne } from "drizzle-orm";
import { ScheduleClient } from "@/components/schedule/schedule-client";

export const metadata = { title: "Agenda — Uxuri" };

interface Props {
  searchParams: Promise<{ date?: string }>;
}

export default async function SchedulePage({ searchParams }: Props) {
  const { userId } = await auth();
  if (!userId) return null;

  const todayStr = new Date().toISOString().split("T")[0];
  const { date } = await searchParams;
  const dateStr = date ?? todayStr;

  const [blocks, pendingTasks] = await Promise.all([
    db.select().from(timeBlocks)
      .where(and(eq(timeBlocks.userId, userId), eq(timeBlocks.date, dateStr)))
      .orderBy(timeBlocks.startMinutes),

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

  return (
    <div className="p-4 md:p-6">
      <ScheduleClient
        initialBlocks={blocks}
        dateStr={dateStr}
        todayStr={todayStr}
        tasks={pendingTasks.map((t) => ({ id: t.id, title: t.title, projectName: t.projectName ?? null }))}
      />
    </div>
  );
}
