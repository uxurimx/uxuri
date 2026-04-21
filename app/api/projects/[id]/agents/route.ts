import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { agentProjectAssignments, agents, tasks } from "@/db/schema";
import { eq, and, ne, count } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { canAccess } from "@/lib/access";
import { projects } from "@/db/schema";

const assignSchema = z.object({
  agentId: z.string().uuid(),
  scope: z.string().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;

  const [project] = await db.select({ createdBy: projects.createdBy, privacy: projects.privacy })
    .from(projects).where(eq(projects.id, projectId));
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const hasAccess = project.privacy === "public" || await canAccess(userId, "project", projectId, project.createdBy);
  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const assignments = await db
    .select({
      id: agentProjectAssignments.id,
      agentId: agentProjectAssignments.agentId,
      scope: agentProjectAssignments.scope,
      createdAt: agentProjectAssignments.createdAt,
      agentName: agents.name,
      agentAvatar: agents.avatar,
      agentColor: agents.color,
      agentSpecialty: agents.specialty,
      agentIsGlobal: agents.isGlobal,
      agentModel: agents.aiModel,
      taskCount: count(tasks.id),
    })
    .from(agentProjectAssignments)
    .innerJoin(agents, eq(agentProjectAssignments.agentId, agents.id))
    .leftJoin(tasks, and(
      eq(tasks.agentId, agents.id),
      eq(tasks.projectId, projectId),
      ne(tasks.status, "done")
    ))
    .where(eq(agentProjectAssignments.projectId, projectId))
    .groupBy(
      agentProjectAssignments.id,
      agents.name,
      agents.avatar,
      agents.color,
      agents.specialty,
      agents.isGlobal,
      agents.aiModel,
    )
    .orderBy(agentProjectAssignments.createdAt);

  return NextResponse.json(assignments);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;

  const [project] = await db.select({ createdBy: projects.createdBy }).from(projects).where(eq(projects.id, projectId));
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!await canAccess(userId, "project", projectId, project.createdBy, "edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [assignment] = await db
    .insert(agentProjectAssignments)
    .values({ projectId, agentId: parsed.data.agentId, scope: parsed.data.scope, createdBy: userId })
    .onConflictDoUpdate({ target: [agentProjectAssignments.agentId, agentProjectAssignments.projectId], set: { scope: parsed.data.scope } })
    .returning();

  return NextResponse.json(assignment, { status: 201 });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;

  const [project] = await db.select({ createdBy: projects.createdBy }).from(projects).where(eq(projects.id, projectId));
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!await canAccess(userId, "project", projectId, project.createdBy, "edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const assignmentId = url.searchParams.get("assignmentId");
  if (!assignmentId) return NextResponse.json({ error: "assignmentId requerido" }, { status: 400 });

  await db.delete(agentProjectAssignments)
    .where(and(eq(agentProjectAssignments.id, assignmentId), eq(agentProjectAssignments.projectId, projectId)));

  return NextResponse.json({ success: true });
}
