import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { objectiveAreas } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertObjectiveAccess } from "@/lib/objective-access";

const createAreaSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  emoji: z.string().max(10).optional(),
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

  const areas = await db
    .select()
    .from(objectiveAreas)
    .where(eq(objectiveAreas.objectiveId, objectiveId))
    .orderBy(objectiveAreas.sortOrder);

  return NextResponse.json(areas);
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
  const parsed = createAreaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [area] = await db
    .insert(objectiveAreas)
    .values({
      objectiveId,
      ...parsed.data,
    })
    .returning();

  return NextResponse.json(area, { status: 201 });
}
