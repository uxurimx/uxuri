import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import {
  objectives,
  objectiveMilestones,
  objectiveProjects,
  objectiveTasks,
  objectiveAgents,
  objectiveAttachments,
  projects,
  tasks,
  agents,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(["draft", "active", "paused", "completed", "cancelled"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  targetDate: z.string().optional().nullable(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [objective] = await db.select().from(objectives).where(eq(objectives.id, id));
  if (!objective) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Milestones
  const milestones = await db
    .select()
    .from(objectiveMilestones)
    .where(eq(objectiveMilestones.objectiveId, id))
    .orderBy(objectiveMilestones.sortOrder, objectiveMilestones.createdAt);

  // Linked projects
  const linkedProjectRows = await db
    .select({ linkId: objectiveProjects.id, project: projects })
    .from(objectiveProjects)
    .leftJoin(projects, eq(objectiveProjects.projectId, projects.id))
    .where(eq(objectiveProjects.objectiveId, id));

  // Linked tasks
  const linkedTaskRows = await db
    .select({ linkId: objectiveTasks.id, task: tasks })
    .from(objectiveTasks)
    .leftJoin(tasks, eq(objectiveTasks.taskId, tasks.id))
    .where(eq(objectiveTasks.objectiveId, id));

  // Linked agents
  const linkedAgentRows = await db
    .select({ linkId: objectiveAgents.id, agent: agents })
    .from(objectiveAgents)
    .leftJoin(agents, eq(objectiveAgents.agentId, agents.id))
    .where(eq(objectiveAgents.objectiveId, id));

  // Attachments
  const attachments = await db
    .select()
    .from(objectiveAttachments)
    .where(eq(objectiveAttachments.objectiveId, id))
    .orderBy(objectiveAttachments.createdAt);

  // Calculate progress
  const totalMilestones = milestones.length;
  const doneMilestones = milestones.filter((m) => m.done).length;
  const milestoneProgress = totalMilestones > 0
    ? Math.round((doneMilestones / totalMilestones) * 100)
    : null;

  const totalProjects = linkedProjectRows.filter((r) => r.project).length;
  const completedProjects = linkedProjectRows.filter(
    (r) => r.project?.status === "completed"
  ).length;
  const projectProgress = totalProjects > 0
    ? Math.round((completedProjects / totalProjects) * 100)
    : null;

  const totalTasks = linkedTaskRows.filter((r) => r.task).length;
  const doneTasks = linkedTaskRows.filter((r) => r.task?.status === "done").length;
  const taskProgress = totalTasks > 0
    ? Math.round((doneTasks / totalTasks) * 100)
    : null;

  const parts = [taskProgress, projectProgress, milestoneProgress].filter(
    (v): v is number => v !== null
  );
  const overall =
    parts.length > 0
      ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length)
      : 0;

  return NextResponse.json({
    ...objective,
    milestones,
    linkedProjects: linkedProjectRows.map((r) => ({ linkId: r.linkId, ...r.project })),
    linkedTasks: linkedTaskRows.map((r) => ({ linkId: r.linkId, ...r.task })),
    linkedAgents: linkedAgentRows.map((r) => ({ linkId: r.linkId, ...r.agent })),
    attachments,
    progress: {
      milestones: milestoneProgress,
      projects: projectProgress,
      tasks: taskProgress,
      overall,
    },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [updated] = await db
    .update(objectives)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(objectives.id, id))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await db.delete(objectives).where(eq(objectives.id, id));
  return NextResponse.json({ success: true });
}
