import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { projects, projectPhases } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { canAccess } from "@/lib/access";

const updatePhaseSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  order: z.number().int().optional(),
  status: z.enum(["pending", "active", "completed", "cancelled"]).optional(),
  completionPercent: z.number().int().min(0).max(100).optional(),
  dueDate: z.string().optional().nullable(),
  billingAmount: z.string().optional().nullable(),
  billingCurrency: z.string().max(10).optional(),
  billedAt: z.string().optional().nullable(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; pid: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, pid } = await params;
  const [project] = await db
    .select({ createdBy: projects.createdBy })
    .from(projects)
    .where(eq(projects.id, id));
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!(await canAccess(userId, "project", id, project.createdBy, "edit"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updatePhaseSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { billedAt: billedAtStr, ...restData } = parsed.data;
  const billedAtParsed = billedAtStr !== undefined
    ? { billedAt: billedAtStr ? new Date(billedAtStr) : null }
    : {};

  const [phase] = await db
    .update(projectPhases)
    .set({ ...restData, ...billedAtParsed, updatedAt: new Date() })
    .where(and(eq(projectPhases.id, pid), eq(projectPhases.projectId, id)))
    .returning();

  if (!phase) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(phase);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; pid: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, pid } = await params;
  const [project] = await db
    .select({ createdBy: projects.createdBy })
    .from(projects)
    .where(eq(projects.id, id));
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!(await canAccess(userId, "project", id, project.createdBy, "edit"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db
    .delete(projectPhases)
    .where(and(eq(projectPhases.id, pid), eq(projectPhases.projectId, id)));

  return NextResponse.json({ ok: true });
}
