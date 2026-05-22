import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { jobPostings, jobQuestions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateJobSchema = z.object({
  title: z.string().min(1).optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
  tagline: z.string().optional(),
  description: z.string().optional(),
  requirements: z.string().optional(),
  employmentType: z.enum(["fixed_salary", "commission", "mixed", "equity_partner"]).optional(),
  status: z.enum(["draft", "open", "paused", "closed"]).optional(),
  applicationType: z.enum(["form", "challenge", "conversation", "video", "hybrid"]).optional(),
  challengeBrief: z.string().nullable().optional(),
  challengeDeadlineHours: z.number().int().positive().nullable().optional(),
  conversationContext: z.string().nullable().optional(),
  closesAt: z.string().datetime().nullable().optional(),
  maxApplications: z.number().int().positive().nullable().optional(),
  isPublic: z.boolean().optional(),
});

const updateQuestionsSchema = z.array(z.object({
  id: z.string().uuid().optional(),
  question: z.string().min(1),
  type: z.enum(["text", "textarea", "url", "video", "select", "multiselect", "choice"]).default("textarea"),
  options: z.array(z.string()).optional().default([]),
  isRequired: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  placeholder: z.string().optional(),
  hint: z.string().optional(),
}));

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [job] = await db
    .select()
    .from(jobPostings)
    .where(and(eq(jobPostings.id, id), eq(jobPostings.createdBy, userId)));

  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const questions = await db
    .select()
    .from(jobQuestions)
    .where(eq(jobQuestions.jobId, id))
    .orderBy(jobQuestions.sortOrder);

  return NextResponse.json({ ...job, questions });
}

export async function PATCH(req: Request, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [existing] = await db
    .select()
    .from(jobPostings)
    .where(and(eq(jobPostings.id, id), eq(jobPostings.createdBy, userId)));

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  // Si viene questions en el body, actualizar preguntas por separado
  if (body.questions !== undefined) {
    const parsedQ = updateQuestionsSchema.safeParse(body.questions);
    if (!parsedQ.success) {
      return NextResponse.json({ error: parsedQ.error.flatten() }, { status: 400 });
    }
    await db.delete(jobQuestions).where(eq(jobQuestions.jobId, id));
    if (parsedQ.data.length > 0) {
      await db.insert(jobQuestions).values(
        parsedQ.data.map((q) => ({ ...q, jobId: id }))
      );
    }
  }

  const { questions: _q, ...jobFields } = body;
  if (Object.keys(jobFields).length === 0) {
    const questions = await db.select().from(jobQuestions).where(eq(jobQuestions.jobId, id)).orderBy(jobQuestions.sortOrder);
    const [job] = await db.select().from(jobPostings).where(eq(jobPostings.id, id));
    return NextResponse.json({ ...job, questions });
  }

  const parsed = updateJobSchema.safeParse(jobFields);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { closesAt, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = { ...rest, updatedAt: new Date() };
  if (closesAt !== undefined) updateData.closesAt = closesAt ? new Date(closesAt) : null;

  const [updated] = await db
    .update(jobPostings)
    .set(updateData)
    .where(eq(jobPostings.id, id))
    .returning();

  const questions = await db.select().from(jobQuestions).where(eq(jobQuestions.jobId, id)).orderBy(jobQuestions.sortOrder);

  return NextResponse.json({ ...updated, questions });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [existing] = await db
    .select()
    .from(jobPostings)
    .where(and(eq(jobPostings.id, id), eq(jobPostings.createdBy, userId)));

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.delete(jobPostings).where(eq(jobPostings.id, id));

  return NextResponse.json({ ok: true });
}
