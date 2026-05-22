import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { deepBreaths } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { require420Access, is420Forbidden } from "@/lib/smoke-guard";

const patchSchema = z.object({
  tripDurationSeconds: z.number().int().min(1).optional(),
  tripDetails: z.string().max(2000).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await require420Access();
  if (is420Forbidden(guard)) return guard;
  const { userId } = guard;
  const { id } = await params;

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [updated] = await db
    .update(deepBreaths)
    .set(parsed.data)
    .where(and(eq(deepBreaths.id, id), eq(deepBreaths.userId, userId)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await require420Access();
  if (is420Forbidden(guard)) return guard;
  const { userId } = guard;
  const { id } = await params;

  await db.delete(deepBreaths).where(and(eq(deepBreaths.id, id), eq(deepBreaths.userId, userId)));
  return NextResponse.json({ ok: true });
}
