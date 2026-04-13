import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { projects, projectPhases } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { canAccess } from "@/lib/access";

const createPhaseSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  order: z.number().int().default(0),
  status: z.enum(["pending", "active", "completed", "cancelled"]).optional(),
  completionPercent: z.number().int().min(0).max(100).optional(),
  dueDate: z.string().optional().nullable(),
  billingAmount: z.string().optional().nullable(),
  billingCurrency: z.string().max(10).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [project] = await db
    .select({ createdBy: projects.createdBy, privacy: projects.privacy })
    .from(projects)
    .where(eq(projects.id, id));
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const hasAccess =
    project.privacy === "public" ||
    (await canAccess(userId, "project", id, project.createdBy, "view"));
  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const phases = await db
    .select()
    .from(projectPhases)
    .where(eq(projectPhases.projectId, id))
    .orderBy(projectPhases.order);

  return NextResponse.json(phases);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [project] = await db
    .select({ createdBy: projects.createdBy })
    .from(projects)
    .where(eq(projects.id, id));
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!(await canAccess(userId, "project", id, project.createdBy, "edit"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createPhaseSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [phase] = await db
    .insert(projectPhases)
    .values({
      projectId: id,
      ...parsed.data,
      createdBy: userId,
    })
    .returning();

  return NextResponse.json(phase, { status: 201 });
}
