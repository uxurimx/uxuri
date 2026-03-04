import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import {
  objectives,
  objectiveMilestones,
  objectiveProjects,
  objectiveTasks,
  projects,
  tasks,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(objectives)
    .where(eq(objectives.pinnedToDashboard, true))
    .orderBy(objectives.createdAt);

  const allMilestones = await db.select().from(objectiveMilestones);
  const linkedProjectsData = await db
    .select({ objectiveId: objectiveProjects.objectiveId, status: projects.status })
    .from(objectiveProjects)
    .leftJoin(projects, eq(objectiveProjects.projectId, projects.id));
  const linkedTasksData = await db
    .select({ objectiveId: objectiveTasks.objectiveId, status: tasks.status })
    .from(objectiveTasks)
    .leftJoin(tasks, eq(objectiveTasks.taskId, tasks.id));

  const result = rows.map((obj) => {
    const mils = allMilestones.filter((m) => m.objectiveId === obj.id);
    const mProgress = mils.length > 0
      ? Math.round((mils.filter((m) => m.done).length / mils.length) * 100)
      : null;

    const pRows = linkedProjectsData.filter((p) => p.objectiveId === obj.id);
    const pProgress = pRows.length > 0
      ? Math.round((pRows.filter((p) => p.status === "completed").length / pRows.length) * 100)
      : null;

    const tRows = linkedTasksData.filter((t) => t.objectiveId === obj.id);
    const tProgress = tRows.length > 0
      ? Math.round((tRows.filter((t) => t.status === "done").length / tRows.length) * 100)
      : null;

    const parts = [mProgress, pProgress, tProgress].filter((v): v is number => v !== null);
    const overallProgress = parts.length > 0
      ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length)
      : 0;

    return { ...obj, overallProgress };
  });

  return NextResponse.json(result);
}
