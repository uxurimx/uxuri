import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { cyclePresets } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  label: z.string().min(1).max(50).optional(),
  minutes: z.number().int().min(1).optional(),
  isHidden: z.boolean().optional(),
});

// PATCH /api/cycle-presets/[id]
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [preset] = await db.select().from(cyclePresets).where(eq(cyclePresets.id, id));
  if (!preset) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (preset.isSystem && preset.userId !== userId && preset.userId !== null) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!preset.isSystem && preset.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Para sistema solo se permite ocultar
  const updateData = preset.isSystem
    ? { isHidden: parsed.data.isHidden }
    : parsed.data;

  const [updated] = await db
    .update(cyclePresets)
    .set(updateData)
    .where(eq(cyclePresets.id, id))
    .returning();

  return NextResponse.json(updated);
}

// DELETE /api/cycle-presets/[id] — solo propios
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [preset] = await db.select().from(cyclePresets).where(
    and(eq(cyclePresets.id, id), eq(cyclePresets.userId, userId))
  );
  if (!preset) return NextResponse.json({ error: "Not found or forbidden" }, { status: 404 });
  if (preset.isSystem) return NextResponse.json({ error: "No puedes eliminar presets del sistema" }, { status: 403 });

  await db.delete(cyclePresets).where(eq(cyclePresets.id, id));
  return NextResponse.json({ success: true });
}
