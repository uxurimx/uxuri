import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { objectiveAreas } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertObjectiveAccess } from "@/lib/objective-access";

const updateAreaSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  emoji: z.string().max(10).optional().nullable(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; aid: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: objectiveId, aid } = await params;
  const access = await assertObjectiveAccess(userId, objectiveId, "edit");
  if (!access.ok) return NextResponse.json({ error: "Forbidden" }, { status: access.status });

  const body = await req.json();
  const parsed = updateAreaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [updated] = await db
    .update(objectiveAreas)
    .set(parsed.data)
    .where(and(eq(objectiveAreas.id, aid), eq(objectiveAreas.objectiveId, objectiveId)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; aid: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: objectiveId, aid } = await params;
  const access = await assertObjectiveAccess(userId, objectiveId, "edit");
  if (!access.ok) return NextResponse.json({ error: "Forbidden" }, { status: access.status });

  await db
    .delete(objectiveAreas)
    .where(and(eq(objectiveAreas.id, aid), eq(objectiveAreas.objectiveId, objectiveId)));

  return NextResponse.json({ success: true });
}
