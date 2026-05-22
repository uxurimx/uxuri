import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { jobPostings, jobQuestions } from "@/db/schema";
import { ensureUser } from "@/lib/ensure-user";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveNewWorkspaceId } from "@/lib/workspace-filter";

const questionSchema = z.object({
  question: z.string().min(1),
  type: z.enum(["text", "textarea", "url", "video", "select", "multiselect", "choice"]).default("textarea"),
  options: z.array(z.string()).optional().default([]),
  isRequired: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  placeholder: z.string().optional(),
  hint: z.string().optional(),
});

const createJobSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  tagline: z.string().optional(),
  description: z.string().optional(),
  requirements: z.string().optional(),
  employmentType: z.enum(["fixed_salary", "commission", "mixed", "equity_partner"]).optional(),
  status: z.enum(["draft", "open", "paused", "closed"]).default("draft"),
  applicationType: z.enum(["form", "challenge", "conversation", "video", "hybrid"]).default("form"),
  challengeBrief: z.string().optional(),
  challengeDeadlineHours: z.number().int().positive().optional(),
  conversationContext: z.string().optional(),
  closesAt: z.string().datetime().optional(),
  maxApplications: z.number().int().positive().optional(),
  isPublic: z.boolean().default(true),
  businessId: z.string().uuid().optional(),
  questions: z.array(questionSchema).default([]),
});

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 180);
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jobs = await db
    .select()
    .from(jobPostings)
    .where(eq(jobPostings.createdBy, userId))
    .orderBy(desc(jobPostings.createdAt));

  return NextResponse.json(jobs);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureUser(userId);

  const body = await req.json();
  const parsed = createJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { questions, slug: rawSlug, closesAt, ...jobData } = parsed.data;
  const workspaceId = await resolveNewWorkspaceId();

  const baseSlug = rawSlug ?? toSlug(jobData.title);

  // Garantizar slug único agregando sufijo numérico si ya existe
  let slug = baseSlug;
  let attempt = 0;
  while (true) {
    const [existing] = await db
      .select({ id: jobPostings.id })
      .from(jobPostings)
      .where(eq(jobPostings.slug, slug));
    if (!existing) break;
    attempt++;
    slug = `${baseSlug}-${attempt}`;
  }

  const [job] = await db
    .insert(jobPostings)
    .values({
      ...jobData,
      slug,
      workspaceId,
      createdBy: userId,
      closesAt: closesAt ? new Date(closesAt) : null,
    })
    .returning();

  if (questions.length > 0) {
    await db.insert(jobQuestions).values(
      questions.map((q) => ({ ...q, jobId: job.id }))
    );
  }

  return NextResponse.json(job, { status: 201 });
}
