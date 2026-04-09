import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { mealPlans, mealEntries } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureUser } from "@/lib/ensure-user";

const entrySchema = z.object({
  dayOfWeek:     z.number().int().min(0).max(6),
  mealTime:      z.enum(["desayuno", "comida", "cena", "snack"]),
  name:          z.string().min(1).max(200),
  estimatedCost: z.number().min(0).optional().nullable(),
  notes:         z.string().optional().nullable(),
});

// POST: add entry (auto-creates plan if it doesn't exist)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ weekStart: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureUser(userId);
  const { weekStart } = await params;

  const body = await req.json();
  const parsed = entrySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Upsert plan
  let [plan] = await db
    .select()
    .from(mealPlans)
    .where(and(eq(mealPlans.userId, userId), eq(mealPlans.weekStart, weekStart)));

  if (!plan) {
    [plan] = await db
      .insert(mealPlans)
      .values({ userId, weekStart })
      .returning();
  }

  const { estimatedCost, ...rest } = parsed.data;
  const [entry] = await db
    .insert(mealEntries)
    .values({
      ...rest,
      planId: plan.id,
      userId,
      estimatedCost: estimatedCost != null ? estimatedCost.toString() : null,
    })
    .returning();

  return NextResponse.json(entry, { status: 201 });
}
