import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { objectiveProjects, objectiveTasks, objectiveAgents } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const linkSchema = z.object({
  type: z.enum(["project", "task", "agent"]),
  id: z.string().uuid(),
  areaId: z.string().uuid().optional(),
});

const unlinkSchema = z.object({
  type: z.enum(["project", "task", "agent"]),
  linkId: z.string().uuid(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: objectiveId } = await params;
  const body = await req.json();
  const parsed = linkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { type, id, areaId } = parsed.data;

  if (type === "project") {
    // Check for duplicate
    const existing = await db
      .select()
      .from(objectiveProjects)
      .where(and(eq(objectiveProjects.objectiveId, objectiveId), eq(objectiveProjects.projectId, id)));
    if (existing.length > 0) {
      return NextResponse.json({ error: "Already linked" }, { status: 409 });
    }

    const [row] = await db
      .insert(objectiveProjects)
      .values({ objectiveId, projectId: id, areaId })
      .returning();
    return NextResponse.json(row, { status: 201 });
  } else if (type === "task") {
    // Check for duplicate
    const existing = await db
      .select()
      .from(objectiveTasks)
      .where(and(eq(objectiveTasks.objectiveId, objectiveId), eq(objectiveTasks.taskId, id)));
    if (existing.length > 0) {
      return NextResponse.json({ error: "Already linked" }, { status: 409 });
    }

    const [row] = await db
      .insert(objectiveTasks)
      .values({ objectiveId, taskId: id, areaId })
      .returning();
    return NextResponse.json(row, { status: 201 });
  } else {
    // Check for duplicate
    const existing = await db
      .select()
      .from(objectiveAgents)
      .where(and(eq(objectiveAgents.objectiveId, objectiveId), eq(objectiveAgents.agentId, id)));
    if (existing.length > 0) {
      return NextResponse.json({ error: "Already linked" }, { status: 409 });
    }

    const [row] = await db
      .insert(objectiveAgents)
      .values({ objectiveId, agentId: id })
      .returning();
    return NextResponse.json(row, { status: 201 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: objectiveId } = await params;
  const body = await req.json();
  const parsed = unlinkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { type, linkId } = parsed.data;

  if (type === "project") {
    await db
      .delete(objectiveProjects)
      .where(
        and(eq(objectiveProjects.id, linkId), eq(objectiveProjects.objectiveId, objectiveId))
      );
  } else if (type === "task") {
    await db
      .delete(objectiveTasks)
      .where(
        and(eq(objectiveTasks.id, linkId), eq(objectiveTasks.objectiveId, objectiveId))
      );
  } else {
    await db
      .delete(objectiveAgents)
      .where(
        and(eq(objectiveAgents.id, linkId), eq(objectiveAgents.objectiveId, objectiveId))
      );
  }

  return NextResponse.json({ success: true });
}
