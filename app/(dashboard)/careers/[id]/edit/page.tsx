import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { jobPostings, jobQuestions, businesses } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { JobForm } from "@/components/careers/job-form";

type Props = { params: Promise<{ id: string }> };

export default async function EditCareerPage({ params }: Props) {
  const { userId } = await auth();
  if (!userId) return null;

  const { id } = await params;

  const [job] = await db
    .select()
    .from(jobPostings)
    .where(and(eq(jobPostings.id, id), eq(jobPostings.createdBy, userId)));

  if (!job) notFound();

  const [questions, userBusinesses] = await Promise.all([
    db.select().from(jobQuestions).where(eq(jobQuestions.jobId, id)).orderBy(jobQuestions.sortOrder)
      .then(qs => qs.map(q => ({ ...q, hint: q.hint ?? "", options: q.options ?? [] }))),
    db.select({ id: businesses.id, name: businesses.name, logo: businesses.logo })
      .from(businesses)
      .where(eq(businesses.ownerId, userId))
      .orderBy(businesses.name),
  ]);

  return (
    <div className="max-w-3xl mx-auto">
      <JobForm job={job} questions={questions} businesses={userBusinesses} />
    </div>
  );
}
