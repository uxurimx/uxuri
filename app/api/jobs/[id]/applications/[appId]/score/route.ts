import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { jobApplications, jobConversations, jobPostings, jobQuestions } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { scoreApplication } from "@/lib/score-application";

type Params = { params: Promise<{ id: string; appId: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, appId } = await params;

  const [job] = await db
    .select()
    .from(jobPostings)
    .where(and(eq(jobPostings.id, id), eq(jobPostings.createdBy, userId)));

  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [application] = await db
    .select()
    .from(jobApplications)
    .where(and(eq(jobApplications.id, appId), eq(jobApplications.jobId, id)));

  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const type = job.applicationType ?? "form";
  const ctx: Parameters<typeof scoreApplication>[1] = {
    jobTitle: job.title,
    jobDescription: job.description,
    challengeBrief: job.challengeBrief,
    applicationType: type,
    applicantName: application.name,
  };

  if (type === "challenge") {
    ctx.submissionUrl = application.submissionUrl;
    ctx.submissionNotes = application.submissionNotes;
  } else if (type === "conversation") {
    const turns = await db
      .select()
      .from(jobConversations)
      .where(eq(jobConversations.applicationId, appId))
      .orderBy(asc(jobConversations.turnIndex));

    ctx.conversationTranscript = turns
      .filter((t) => t.role !== "system")
      .map((t) => `${t.role === "user" ? application.name : "Kairos"}: ${t.content}`)
      .join("\n\n");
  } else if (type === "form") {
    const questions = await db
      .select({ id: jobQuestions.id, question: jobQuestions.question })
      .from(jobQuestions)
      .where(eq(jobQuestions.jobId, id));

    const answers = (application.answers as { questionId: string; value: string | string[] }[]) ?? [];
    ctx.answers = answers.map((a) => {
      const q = questions.find((q) => q.id === a.questionId);
      return {
        question: q?.question ?? a.questionId,
        answer: Array.isArray(a.value) ? a.value.join(", ") : a.value,
      };
    });
  }

  // Fire scoring — awaited so the client knows when it finishes
  await scoreApplication(appId, ctx);

  const [updated] = await db
    .select()
    .from(jobApplications)
    .where(eq(jobApplications.id, appId));

  return NextResponse.json(updated);
}
