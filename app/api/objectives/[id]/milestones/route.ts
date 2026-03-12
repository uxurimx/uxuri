import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { objectiveMilestones } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertObjectiveAccess } from "@/lib/objective-access";

const createSchema = z.object({
  title: z.string().min(1),
  sortOrder: z.number().int().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: objectiveId } = await params;
  const access = await assertObjectiveAccess(userId, objectiveId, "view");
  if (!access.ok) return NextResponse.json({ error: "Forbidden" }, { status: access.status });

  const rows = await db
    .select()
    .from(objectiveMilestones)
    .where(eq(objectiveMilestones.objectiveId, objectiveId))
    .orderBy(objectiveMilestones.sortOrder, objectiveMilestones.createdAt);

  return NextResponse.json(rows);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: objectiveId } = await params;
  const access = await assertObjectiveAccess(userId, objectiveId, "edit");
  if (!access.ok) return NextResponse.json({ error: "Forbidden" }, { status: access.status });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [milestone] = await db
    .insert(objectiveMilestones)
    .values({ ...parsed.data, objectiveId })
    .returning();

  return NextResponse.json(milestone, { status: 201 });
}
