import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { budgets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  businessId:  z.string().uuid().optional().nullable(),
  category:    z.string().min(1).max(50).optional(),
  limitAmount: z.number().positive().optional(),
  currency:    z.enum(["MXN", "USD", "EUR", "BTC", "ETH", "USDT", "other"]).optional(),
  period:      z.enum(["weekly", "monthly", "yearly"]).optional(),
  isActive:    z.boolean().optional(),
  notes:       z.string().optional().nullable(),
});

async function getOwned(id: string, userId: string) {
  const [b] = await db.select().from(budgets).where(eq(budgets.id, id));
  if (!b) return null;
  if (b.userId !== userId) return false;
  return b;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const b = await getOwned(id, userId);
  if (b === null)  return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (b === false) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { limitAmount, ...rest } = parsed.data;
  const update: Record<string, unknown> = { ...rest, updatedAt: new Date() };
  if (limitAmount !== undefined) update.limitAmount = limitAmount.toString();

  const [updated] = await db.update(budgets).set(update as never).where(eq(budgets.id, id)).returning();
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const b = await getOwned(id, userId);
  if (b === null)  return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (b === false) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await db.delete(budgets).where(eq(budgets.id, id));
  return NextResponse.json({ success: true });
}
