import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { jobPostings, jobApplications } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { CareersHeader } from "@/components/careers/careers-header";
import { CareersList } from "@/components/careers/careers-list";

export default async function CareersPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const jobs = await db
    .select({
      id: jobPostings.id,
      title: jobPostings.title,
      slug: jobPostings.slug,
      status: jobPostings.status,
      employmentType: jobPostings.employmentType,
      isPublic: jobPostings.isPublic,
      viewCount: jobPostings.viewCount,
      closesAt: jobPostings.closesAt,
      createdAt: jobPostings.createdAt,
      totalApplications: sql<number>`
        (SELECT COUNT(*) FROM job_applications WHERE job_id = ${jobPostings.id})::int
      `,
      newApplications: sql<number>`
        (SELECT COUNT(*) FROM job_applications WHERE job_id = ${jobPostings.id} AND status = 'new')::int
      `,
    })
    .from(jobPostings)
    .where(eq(jobPostings.createdBy, userId))
    .orderBy(jobPostings.createdAt);

  return (
    <div className="space-y-6">
      <CareersHeader totalJobs={jobs.length} />
      <CareersList jobs={jobs} />
    </div>
  );
}
