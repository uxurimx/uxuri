import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { savingsGoals, savingsContributions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const contributeSchema = z.object({
  amount:        z.number().positive(),
  date:          z.string(),
  note:          z.string().optional(),
  transactionId: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify ownership
  const [goal] = await db
    .select({ id: savingsGoals.id, targetAmount: savingsGoals.targetAmount })
    .from(savingsGoals)
    .where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, userId)));

  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = contributeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { amount, date, note, transactionId } = parsed.data;

  const [contribution] = await db
    .insert(savingsContributions)
    .values({
      goalId: id,
      userId,
      amount: amount.toString(),
      date,
      note,
      transactionId,
    })
    .returning();

  return NextResponse.json(contribution, { status: 201 });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [goal] = await db
    .select({ id: savingsGoals.id })
    .from(savingsGoals)
    .where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, userId)));

  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const contributions = await db
    .select()
    .from(savingsContributions)
    .where(eq(savingsContributions.goalId, id))
    .orderBy(savingsContributions.date);

  return NextResponse.json(contributions.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
  })));
}
