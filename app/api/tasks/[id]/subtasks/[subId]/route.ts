import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { subtasks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const patchSchema = z.object({
  done:  z.boolean().optional(),
  title: z.string().min(1).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; subId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { subId } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [sub] = await db
    .update(subtasks)
    .set(parsed.data)
    .where(eq(subtasks.id, subId))
    .returning();

  return NextResponse.json(sub);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; subId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { subId } = await params;
  await db.delete(subtasks).where(eq(subtasks.id, subId));
  return NextResponse.json({ ok: true });
}
