import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { objectives, objectiveMilestones, objectiveProjects, objectiveTasks } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

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

  const rows = await db.select().from(objectives).orderBy(objectives.createdAt);

  // Get milestone counts per objective
  const milestoneCounts = await db
    .select({
      objectiveId: objectiveMilestones.objectiveId,
      total: count(),
    })
    .from(objectiveMilestones)
    .groupBy(objectiveMilestones.objectiveId);

  const projectCounts = await db
    .select({
      objectiveId: objectiveProjects.objectiveId,
      total: count(),
    })
    .from(objectiveProjects)
    .groupBy(objectiveProjects.objectiveId);

  const taskCounts = await db
    .select({
      objectiveId: objectiveTasks.objectiveId,
      total: count(),
    })
    .from(objectiveTasks)
    .groupBy(objectiveTasks.objectiveId);

  const result = rows.map((obj) => ({
    ...obj,
    milestoneCount: milestoneCounts.find((m) => m.objectiveId === obj.id)?.total ?? 0,
    projectCount: projectCounts.find((p) => p.objectiveId === obj.id)?.total ?? 0,
    taskCount: taskCounts.find((t) => t.objectiveId === obj.id)?.total ?? 0,
  }));

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
    .values({
      ...parsed.data,
      createdBy: userId,
    })
    .returning();

  return NextResponse.json(objective, { status: 201 });
}
