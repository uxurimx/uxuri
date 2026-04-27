import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { projects, tasks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { canAccess } from "@/lib/access";

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  clientId: z.string().uuid().optional().nullable(),
  status: z.enum(["planning", "active", "paused", "completed", "cancelled"]).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  privacy: z.enum(["public", "private"]).optional(),
  range: z.enum(["short", "long"]).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  cycleMinutes: z.number().int().min(1).optional().nullable(),
  businessId: z.string().uuid().optional().nullable(),
  linkedCodePath: z.string().optional().nullable(),
  linkedRepo: z.string().max(500).optional().nullable(),
  techStack: z.string().optional().nullable(),
  workspaceId: z.string().uuid().optional().nullable(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [project] = await db.select().from(projects).where(eq(projects.id, id));
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Allow if owner, shared, or project is public
  const hasAccess = project.privacy === "public"
    || await canAccess(userId, "project", id, project.createdBy);
  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json(project);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [project] = await db.select({ createdBy: projects.createdBy }).from(projects).where(eq(projects.id, id));
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = updateProjectSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { cycleMinutes, ...rest } = parsed.data;

  // Ciclos: cualquier colaborador (view o edit) puede ajustarlos.
  // Ediciones estructurales (nombre, estado, etc.) requieren permiso "edit".
  const isCycleOnlyUpdate = Object.keys(parsed.data).every((k) => k === "cycleMinutes");
  const requiredPermission = isCycleOnlyUpdate ? "view" : "edit";

  if (!await canAccess(userId, "project", id, project.createdBy, requiredPermission)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const update: Record<string, unknown> = { ...rest, updatedAt: new Date() };

  if (cycleMinutes !== undefined) {
    update.cycleMinutes = cycleMinutes;
    if (cycleMinutes) {
      const now = new Date();
      update.lastCycleAt = now;
      update.nextCycleAt = new Date(now.getTime() + cycleMinutes * 60_000);
    } else {
      update.lastCycleAt = null;
      update.nextCycleAt = null;
    }
  }

  const [updated] = await db.update(projects)
    .set(update as never)
    .where(eq(projects.id, id))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [project] = await db.select({ createdBy: projects.createdBy }).from(projects).where(eq(projects.id, id));
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (project.createdBy !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.update(tasks).set({ projectId: null }).where(eq(tasks.projectId, id));
  await db.delete(projects).where(eq(projects.id, id));
  return NextResponse.json({ success: true });
}
