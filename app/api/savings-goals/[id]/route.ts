import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { savingsGoals } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const patchSchema = z.object({
  name:         z.string().min(1).max(200).optional(),
  description:  z.string().nullable().optional(),
  targetAmount: z.number().positive().optional(),
  currency:     z.enum(["MXN", "USD", "EUR", "BTC", "ETH", "USDT", "other"]).optional(),
  category:     z.enum(["viaje","compra","emergencia","inversion","educacion","salud","hogar","otro"]).optional(),
  deadline:     z.string().nullable().optional(),
  objectiveId:  z.string().uuid().nullable().optional(),
  businessId:   z.string().uuid().nullable().optional(),
  notes:        z.string().nullable().optional(),
  isCompleted:  z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { targetAmount, ...rest } = parsed.data;

  const [updated] = await db
    .update(savingsGoals)
    .set({
      ...rest,
      ...(targetAmount !== undefined ? { targetAmount: targetAmount.toString() } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, userId)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await db
    .delete(savingsGoals)
    .where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, userId)));

  return NextResponse.json({ ok: true });
}
