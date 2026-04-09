import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { savingsGoals, savingsContributions } from "@/db/schema";
import { eq, sql, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  name:         z.string().min(1).max(200),
  description:  z.string().nullable().optional(),
  targetAmount: z.number().positive(),
  currency:     z.enum(["MXN", "USD", "EUR", "BTC", "ETH", "USDT", "other"]).default("MXN"),
  category:     z.enum(["viaje","compra","emergencia","inversion","educacion","salud","hogar","otro"]).default("otro"),
  deadline:     z.string().nullable().optional(),
  objectiveId:  z.string().uuid().nullable().optional(),
  notes:        z.string().nullable().optional(),
});

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const goals = await db
    .select()
    .from(savingsGoals)
    .where(eq(savingsGoals.userId, userId))
    .orderBy(savingsGoals.isCompleted, savingsGoals.createdAt);

  if (goals.length === 0) return NextResponse.json([]);

  // Compute saved amount for each goal in one query
  const goalIds = goals.map((g) => g.id);
  const sums = await db
    .select({
      goalId: savingsContributions.goalId,
      total:  sql<string>`cast(sum(${savingsContributions.amount}) as text)`,
    })
    .from(savingsContributions)
    .where(inArray(savingsContributions.goalId, goalIds))
    .groupBy(savingsContributions.goalId);

  const sumMap: Record<string, number> = {};
  for (const row of sums) sumMap[row.goalId] = parseFloat(row.total);

  const result = goals.map((g) => ({
    ...g,
    savedAmount: sumMap[g.id] ?? 0,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { name, description, targetAmount, currency, category, deadline, objectiveId, notes } = parsed.data;

  const [goal] = await db
    .insert(savingsGoals)
    .values({
      userId,
      name,
      description,
      targetAmount: targetAmount.toString(),
      currency: currency as never,
      category: category as never,
      deadline: deadline ?? null,
      objectiveId: objectiveId ?? null,
      notes,
    })
    .returning();

  return NextResponse.json({ ...goal, savedAmount: 0 }, { status: 201 });
}
