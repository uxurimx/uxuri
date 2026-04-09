import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { mealEntries } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  name:          z.string().min(1).max(200).optional(),
  estimatedCost: z.number().min(0).optional().nullable(),
  notes:         z.string().optional().nullable(),
});

async function getOwned(entryId: string, userId: string) {
  const [entry] = await db.select().from(mealEntries).where(eq(mealEntries.id, entryId));
  if (!entry) return null;
  if (entry.userId !== userId) return false;
  return entry;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ weekStart: string; entryId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { entryId } = await params;
  const entry = await getOwned(entryId, userId);
  if (entry === null)  return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (entry === false) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { estimatedCost, ...rest } = parsed.data;
  const update: Record<string, unknown> = { ...rest, updatedAt: new Date() };
  if (estimatedCost !== undefined) update.estimatedCost = estimatedCost != null ? estimatedCost.toString() : null;

  const [updated] = await db.update(mealEntries).set(update as never).where(eq(mealEntries.id, entryId)).returning();
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ weekStart: string; entryId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { entryId } = await params;
  const entry = await getOwned(entryId, userId);
  if (entry === null)  return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (entry === false) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await db.delete(mealEntries).where(eq(mealEntries.id, entryId));
  return NextResponse.json({ success: true });
}
