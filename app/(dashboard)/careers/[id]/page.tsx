import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { jobPostings, jobQuestions, jobApplications } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { CareersBoard } from "@/components/careers/careers-board";

type Props = { params: Promise<{ id: string }> };

export default async function CareerDetailPage({ params }: Props) {
  const { userId } = await auth();
  if (!userId) return null;

  const { id } = await params;

  const [job] = await db
    .select()
    .from(jobPostings)
    .where(and(eq(jobPostings.id, id), eq(jobPostings.createdBy, userId)));

  if (!job) notFound();

  const [questions, applications] = await Promise.all([
    db.select().from(jobQuestions).where(eq(jobQuestions.jobId, id)).orderBy(jobQuestions.sortOrder),
    db.select().from(jobApplications).where(eq(jobApplications.jobId, id)).orderBy(jobApplications.appliedAt),
  ]);

  return (
    <CareersBoard job={job} questions={questions} applications={applications} />
  );
}
