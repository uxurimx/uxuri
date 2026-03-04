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
import { eq, count } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getRole } from "@/lib/auth";

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(["draft", "active", "paused", "completed", "cancelled"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  targetDate: z.string().optional().nullable(),
});

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getRole();
  const isAdmin = role === "admin";

  const rows = isAdmin
    ? await db.select().from(objectives).orderBy(objectives.createdAt)
    : await db.select().from(objectives).where(eq(objectives.createdBy, userId)).orderBy(objectives.createdAt);

  const allMilestones = await db.select().from(objectiveMilestones);

  const milestoneCounts = await db
    .select({ objectiveId: objectiveMilestones.objectiveId, total: count() })
    .from(objectiveMilestones)
    .groupBy(objectiveMilestones.objectiveId);

  const projectCounts = await db
    .select({ objectiveId: objectiveProjects.objectiveId, total: count() })
    .from(objectiveProjects)
    .groupBy(objectiveProjects.objectiveId);

  const taskCounts = await db
    .select({ objectiveId: objectiveTasks.objectiveId, total: count() })
    .from(objectiveTasks)
    .groupBy(objectiveTasks.objectiveId);

  const linkedProjectsData = await db
    .select({ objectiveId: objectiveProjects.objectiveId, status: projects.status })
    .from(objectiveProjects)
    .leftJoin(projects, eq(objectiveProjects.projectId, projects.id));

  const linkedTasksData = await db
    .select({ objectiveId: objectiveTasks.objectiveId, status: tasks.status })
    .from(objectiveTasks)
    .leftJoin(tasks, eq(objectiveTasks.taskId, tasks.id));

  const result = rows.map((obj) => {
    const mCount = milestoneCounts.find((m) => m.objectiveId === obj.id)?.total ?? 0;
    const mDone = allMilestones.filter((m) => m.objectiveId === obj.id && m.done).length;
    const mProgress = mCount > 0 ? Math.round((mDone / mCount) * 100) : null;

    const pCount = projectCounts.find((p) => p.objectiveId === obj.id)?.total ?? 0;
    const pCompleted = linkedProjectsData.filter(
      (p) => p.objectiveId === obj.id && p.status === "completed"
    ).length;
    const pProgress = pCount > 0 ? Math.round((pCompleted / pCount) * 100) : null;

    const tCount = taskCounts.find((t) => t.objectiveId === obj.id)?.total ?? 0;
    const tDone = linkedTasksData.filter(
      (t) => t.objectiveId === obj.id && t.status === "done"
    ).length;
    const tProgress = tCount > 0 ? Math.round((tDone / tCount) * 100) : null;

    const parts = [mProgress, pProgress, tProgress].filter((v): v is number => v !== null);
    const overallProgress =
      parts.length > 0 ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : 0;

    return {
      ...obj,
      milestoneCount: mCount,
      projectCount: pCount,
      taskCount: tCount,
      overallProgress,
    };
  });

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [objective] = await db
    .insert(objectives)
    .values({ ...parsed.data, createdBy: userId })
    .returning();

  return NextResponse.json(objective, { status: 201 });
}
