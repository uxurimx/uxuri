import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { taskCategories } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(10).optional(),
  isHidden: z.boolean().optional(), // solo para categorías sistema
});

// PATCH /api/categories/[id]
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [cat] = await db.select().from(taskCategories).where(eq(taskCategories.id, id));
  if (!cat) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Las del sistema solo se pueden ocultar/mostrar; las propias se pueden editar
  if (cat.isSystem && cat.createdBy !== null) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!cat.isSystem && cat.createdBy !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Para categorías sistema solo se permite cambiar isHidden
  const updateData = cat.isSystem
    ? { isHidden: parsed.data.isHidden }
    : parsed.data;

  const [updated] = await db
    .update(taskCategories)
    .set(updateData)
    .where(eq(taskCategories.id, id))
    .returning();

  return NextResponse.json(updated);
}

// DELETE /api/categories/[id] — solo categorías propias
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [cat] = await db.select().from(taskCategories).where(
    and(eq(taskCategories.id, id), eq(taskCategories.createdBy, userId))
  );
  if (!cat) return NextResponse.json({ error: "Not found or forbidden" }, { status: 404 });
  if (cat.isSystem) return NextResponse.json({ error: "No puedes eliminar categorías del sistema" }, { status: 403 });

  await db.delete(taskCategories).where(eq(taskCategories.id, id));
  return NextResponse.json({ success: true });
}
