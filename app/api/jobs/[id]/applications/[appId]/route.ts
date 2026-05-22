import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { jobApplications, jobPostings } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateApplicationSchema = z.object({
  status: z.enum(["new", "reviewing", "shortlisted", "interview", "hired", "rejected"]).optional(),
  score: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().optional(),
});

type Params = { params: Promise<{ id: string; appId: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, appId } = await params;

  // Verificar ownership de la vacante
  const [job] = await db
    .select({ id: jobPostings.id })
    .from(jobPostings)
    .where(and(eq(jobPostings.id, id), eq(jobPostings.createdBy, userId)));

  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = updateApplicationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status) {
    updateData.reviewedAt = new Date();
    updateData.reviewedBy = userId;
  }

  const [updated] = await db
    .update(jobApplications)
    .set(updateData)
    .where(and(eq(jobApplications.id, appId), eq(jobApplications.jobId, id)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, appId } = await params;

  const [job] = await db
    .select({ id: jobPostings.id })
    .from(jobPostings)
    .where(and(eq(jobPostings.id, id), eq(jobPostings.createdBy, userId)));

  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db
    .delete(jobApplications)
    .where(and(eq(jobApplications.id, appId), eq(jobApplications.jobId, id)));

  return NextResponse.json({ ok: true });
}
