import { db } from "@/db";
import { jobApplications, jobPostings } from "@/db/schema";
import { eq, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const applySchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  answers: z.array(z.object({
    questionId: z.string(),
    value: z.union([z.string(), z.array(z.string())]),
  })).default([]),
  source: z.string().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;

  // id puede ser UUID o slug
  const isUuid = /^[0-9a-f-]{36}$/.test(id);
  const [job] = await db
    .select({ id: jobPostings.id, status: jobPostings.status, maxApplications: jobPostings.maxApplications })
    .from(jobPostings)
    .where(
      isUuid
        ? eq(jobPostings.id, id)
        : eq(jobPostings.slug, id)
    );

  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (job.status !== "open") return NextResponse.json({ error: "Esta vacante no está activa" }, { status: 400 });

  // Verificar límite de aplicaciones
  if (job.maxApplications) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(jobApplications)
      .where(eq(jobApplications.jobId, job.id));
    if (count >= job.maxApplications) {
      return NextResponse.json({ error: "Esta vacante ya alcanzó el máximo de aplicaciones" }, { status: 400 });
    }
  }

  const body = await req.json();
  const parsed = applySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [application] = await db
    .insert(jobApplications)
    .values({
      jobId: job.id,
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone ?? null,
      answers: parsed.data.answers,
      source: parsed.data.source ?? null,
    })
    .returning({ id: jobApplications.id });

  return NextResponse.json({ ok: true, id: application.id }, { status: 201 });
}
