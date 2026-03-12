import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { objectiveAttachments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertObjectiveAccess } from "@/lib/objective-access";

const createSchema = z.object({
  url: z.string().url(),
  name: z.string().min(1),
  size: z.number().int().optional(),
  type: z.string().optional(),
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
    .from(objectiveAttachments)
    .where(eq(objectiveAttachments.objectiveId, objectiveId))
    .orderBy(objectiveAttachments.createdAt);

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

  const [attachment] = await db
    .insert(objectiveAttachments)
    .values({ ...parsed.data, objectiveId, uploadedBy: userId })
    .returning();

  return NextResponse.json(attachment, { status: 201 });
}
