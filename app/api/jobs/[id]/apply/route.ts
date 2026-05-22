import { db } from "@/db";
import { jobApplications, jobPostings, jobQuestions } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { scoreApplication } from "@/lib/score-application";

const baseFields = {
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  source: z.string().optional(),
};

const formSchema = z.object({
  ...baseFields,
  answers: z.array(z.object({
    questionId: z.string(),
    value: z.union([z.string(), z.array(z.string())]),
  })).default([]),
});

const challengeSchema = z.object({
  ...baseFields,
  submissionUrl: z.string().url({ message: "Incluye un enlace válido con tu evidencia." }),
  submissionNotes: z.string().min(10, { message: "Describe brevemente qué hiciste." }),
  submissionFileUrl: z.string().url().optional().or(z.literal("")),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;

  const isUuid = /^[0-9a-f-]{36}$/.test(id);
  const [job] = await db
    .select()
    .from(jobPostings)
    .where(isUuid ? eq(jobPostings.id, id) : eq(jobPostings.slug, id));

  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (job.status !== "open") return NextResponse.json({ error: "Esta vacante no está activa" }, { status: 400 });

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
  const type = job.applicationType ?? "form";

  // ── Challenge mode ────────────────────────────────────────────────────────
  if (type === "challenge") {
    const parsed = challengeSchema.safeParse(body);
    if (!parsed.success) {
      const issues = parsed.error.errors.map(e => e.message).join(" ");
      return NextResponse.json({ error: issues }, { status: 400 });
    }

    const { name, email, phone, source, submissionUrl, submissionNotes, submissionFileUrl } = parsed.data;

    const [application] = await db
      .insert(jobApplications)
      .values({
        jobId: job.id,
        name, email,
        phone: phone ?? null,
        source: source ?? null,
        submissionUrl,
        submissionNotes,
        submissionFileUrl: submissionFileUrl || null,
        answers: [],
      })
      .returning();

    // Scoring asíncrono — no bloquea la respuesta
    scoreApplication(application.id, {
      jobTitle: job.title,
      jobDescription: job.description,
      challengeBrief: job.challengeBrief,
      applicationType: "challenge",
      applicantName: name,
      submissionUrl,
      submissionNotes,
    }).catch(console.error);

    return NextResponse.json({ ok: true, id: application.id }, { status: 201 });
  }

  // ── Form mode (default) ───────────────────────────────────────────────────
  const parsed = formSchema.safeParse(body);
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
    .returning();

  // Scoring de formularios: cargar preguntas para contexto
  if (parsed.data.answers.length > 0) {
    const questions = await db
      .select({ id: jobQuestions.id, question: jobQuestions.question })
      .from(jobQuestions)
      .where(eq(jobQuestions.jobId, job.id));

    const answersWithText = parsed.data.answers.map(a => {
      const q = questions.find(q => q.id === a.questionId);
      return {
        question: q?.question ?? a.questionId,
        answer: Array.isArray(a.value) ? a.value.join(", ") : a.value,
      };
    });

    scoreApplication(application.id, {
      jobTitle: job.title,
      jobDescription: job.description,
      challengeBrief: null,
      applicationType: "form",
      applicantName: parsed.data.name,
      answers: answersWithText,
    }).catch(console.error);
  }

  return NextResponse.json({ ok: true, id: application.id }, { status: 201 });
}
