import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { objectiveMilestones } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertObjectiveAccess } from "@/lib/objective-access";

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  done: z.boolean().optional(),
  dueDate: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; mid: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: objectiveId, mid } = await params;
  const access = await assertObjectiveAccess(userId, objectiveId, "edit");
  if (!access.ok) return NextResponse.json({ error: "Forbidden" }, { status: access.status });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [updated] = await db
    .update(objectiveMilestones)
    .set(parsed.data)
    .where(
      and(eq(objectiveMilestones.id, mid), eq(objectiveMilestones.objectiveId, objectiveId))
    )
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; mid: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: objectiveId, mid } = await params;
  const access = await assertObjectiveAccess(userId, objectiveId, "edit");
  if (!access.ok) return NextResponse.json({ error: "Forbidden" }, { status: access.status });

  await db
    .delete(objectiveMilestones)
    .where(
      and(eq(objectiveMilestones.id, mid), eq(objectiveMilestones.objectiveId, objectiveId))
    );
  return NextResponse.json({ success: true });
}
