import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { JobForm } from "@/components/careers/job-form";

export default async function NewCareerPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const userBusinesses = await db
    .select({ id: businesses.id, name: businesses.name, logo: businesses.logo })
    .from(businesses)
    .where(eq(businesses.ownerId, userId))
    .orderBy(businesses.name);

  return (
    <div className="max-w-3xl mx-auto">
      <JobForm businesses={userBusinesses} />
    </div>
  );
}
