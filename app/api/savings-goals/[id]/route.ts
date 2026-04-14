import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { savingsGoals, businesses, businessMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

async function getUserBizIds(userId: string): Promise<string[]> {
  const [owned, member] = await Promise.all([
    db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, userId)),
    db.select({ businessId: businessMembers.businessId }).from(businessMembers).where(eq(businessMembers.userId, userId)),
  ]);
  return [...new Set([...owned.map((b) => b.id), ...member.map((m) => m.businessId)])];
}

async function canAccess(id: string, userId: string) {
  const [goal] = await db.select().from(savingsGoals).where(eq(savingsGoals.id, id));
  if (!goal) return null;
  if (goal.userId === userId) return goal;
  if (goal.businessId) {
    const bizIds = await getUserBizIds(userId);
    if (bizIds.includes(goal.businessId)) return goal;
  }
  return false;
}

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
  const access = await canAccess(id, userId);
  if (access === null)  return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (access === false) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
    .where(eq(savingsGoals.id, id))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await canAccess(id, userId);
  if (access === null)  return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (access === false) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.delete(savingsGoals).where(eq(savingsGoals.id, id));
  return NextResponse.json({ ok: true });
}
