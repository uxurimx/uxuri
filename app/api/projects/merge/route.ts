import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { projects, tasks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { canAccess } from "@/lib/access";

const schema = z.object({
  sourceId: z.string().uuid(),
  targetId: z.string().uuid(),
  deleteSource: z.boolean().default(false),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { sourceId, targetId, deleteSource } = parsed.data;

  if (sourceId === targetId) {
    return NextResponse.json({ error: "El origen y destino deben ser proyectos distintos" }, { status: 400 });
  }

  const [[source], [target]] = await Promise.all([
    db.select({ createdBy: projects.createdBy, name: projects.name }).from(projects).where(eq(projects.id, sourceId)),
    db.select({ createdBy: projects.createdBy, name: projects.name }).from(projects).where(eq(projects.id, targetId)),
  ]);

  if (!source || !target) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  const [canSource, canTarget] = await Promise.all([
    canAccess(userId, "project", sourceId, source.createdBy, "edit"),
    canAccess(userId, "project", targetId, target.createdBy, "edit"),
  ]);
  if (!canSource || !canTarget) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const moved = await db
    .update(tasks)
    .set({ projectId: targetId })
    .where(eq(tasks.projectId, sourceId))
    .returning({ id: tasks.id });

  if (deleteSource) {
    await db.delete(projects).where(eq(projects.id, sourceId));
  }

  return NextResponse.json({ movedTasks: moved.length });
}
