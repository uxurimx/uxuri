import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { jobApplications, jobPostings } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verificar que la vacante pertenece al usuario
  const [job] = await db
    .select({ id: jobPostings.id })
    .from(jobPostings)
    .where(and(eq(jobPostings.id, id), eq(jobPostings.createdBy, userId)));

  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const applications = await db
    .select()
    .from(jobApplications)
    .where(eq(jobApplications.jobId, id))
    .orderBy(desc(jobApplications.appliedAt));

  return NextResponse.json(applications);
}
