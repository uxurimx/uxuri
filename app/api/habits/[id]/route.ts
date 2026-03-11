import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { habits } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const patchSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  frequency: z.enum(["daily", "weekdays", "weekends", "weekly"]).optional(),
  targetDays: z.number().int().min(1).max(7).optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [updated] = await db
    .update(habits)
    .set(parsed.data)
    .where(and(eq(habits.id, id), eq(habits.userId, userId)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  // Soft delete
  await db
    .update(habits)
    .set({ isActive: false })
    .where(and(eq(habits.id, id), eq(habits.userId, userId)));

  return NextResponse.json({ success: true });
}
