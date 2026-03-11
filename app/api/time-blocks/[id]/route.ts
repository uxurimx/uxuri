import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { timeBlocks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const patchSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  startMinutes: z.number().int().optional(),
  endMinutes: z.number().int().optional(),
  color: z.string().optional(),
  notes: z.string().optional().nullable(),
  done: z.boolean().optional(),
  taskId: z.string().uuid().optional().nullable(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [updated] = await db.update(timeBlocks).set(parsed.data)
    .where(and(eq(timeBlocks.id, id), eq(timeBlocks.userId, userId))).returning();
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await db.delete(timeBlocks).where(and(eq(timeBlocks.id, id), eq(timeBlocks.userId, userId)));
  return NextResponse.json({ success: true });
}
