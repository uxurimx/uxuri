import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { canAccess } from "@/lib/access";
import { calcMomentumOnReview, getCycleInfo } from "@/lib/cycles";

// POST /api/projects/[id]/review
// Marca el proyecto como revisado: reinicia el ciclo y actualiza momentum.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [project] = await db
    .select({
      createdBy: projects.createdBy,
      cycleHours: projects.cycleHours,
      lastCycleAt: projects.lastCycleAt,
      nextCycleAt: projects.nextCycleAt,
      momentum: projects.momentum,
    })
    .from(projects)
    .where(eq(projects.id, id));

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!await canAccess(userId, "project", id, project.createdBy, "edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!project.cycleHours) {
    return NextResponse.json({ error: "Este proyecto no tiene ciclo configurado" }, { status: 400 });
  }

  const info = getCycleInfo(project.cycleHours, project.lastCycleAt, project.nextCycleAt);
  const wasOverdue = info.phase === "overdue";
  const newMomentum = calcMomentumOnReview(project.momentum, wasOverdue);

  const now = new Date();
  const [updated] = await db
    .update(projects)
    .set({
      lastCycleAt: now,
      nextCycleAt: new Date(now.getTime() + project.cycleHours * 3_600_000),
      momentum: newMomentum,
      updatedAt: now,
    })
    .where(eq(projects.id, id))
    .returning({
      lastCycleAt: projects.lastCycleAt,
      nextCycleAt: projects.nextCycleAt,
      momentum: projects.momentum,
    });

  return NextResponse.json(updated);
}
