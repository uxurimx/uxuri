import { db } from "@/db";
import { roles } from "@/db/schema";
import { requireAccess } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";

const updateRoleSchema = z.object({
  label: z.string().min(1).optional(),
  permissions: z.array(z.string()).optional(),
  isDefault: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAccess("/users");

  const { id } = await params;
  const body = await req.json();
  const parsed = updateRoleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Si se marca como default, quitar default de los demás
  if (parsed.data.isDefault) {
    await db.update(roles).set({ isDefault: false });
  }

  const [updated] = await db
    .update(roles)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(roles.id, id))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAccess("/users");

  const { id } = await params;
  const [deleted] = await db.delete(roles).where(eq(roles.id, id)).returning();
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
