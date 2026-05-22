import { db } from "@/db";
import { jobPostings, jobQuestions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { JobLanding } from "@/components/jobs/job-landing";
import type { Metadata } from "next";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [job] = await db.select({ title: jobPostings.title, tagline: jobPostings.tagline })
    .from(jobPostings)
    .where(eq(jobPostings.slug, slug));

  if (!job) return { title: "Vacante no encontrada" };
  return {
    title: job.title,
    description: job.tagline ?? undefined,
  };
}

export default async function JobPage({ params }: Props) {
  const { slug } = await params;

  const [job] = await db.select().from(jobPostings).where(eq(jobPostings.slug, slug));
  if (!job) notFound();

  const questions = await db
    .select()
    .from(jobQuestions)
    .where(eq(jobQuestions.jobId, job.id))
    .orderBy(jobQuestions.sortOrder);

  return <JobLanding job={job} questions={questions} />;
}
