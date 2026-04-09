import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { budgets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureUser } from "@/lib/ensure-user";

const createSchema = z.object({
  businessId:  z.string().uuid().optional().nullable(),
  category:    z.string().min(1).max(50),
  limitAmount: z.number().positive(),
  currency:    z.enum(["MXN", "USD", "EUR", "BTC", "ETH", "USDT", "other"]).optional(),
  period:      z.enum(["weekly", "monthly", "yearly"]).optional(),
  notes:       z.string().optional().nullable(),
});

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(budgets)
    .where(eq(budgets.userId, userId))
    .orderBy(budgets.category);

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureUser(userId);

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { limitAmount, ...rest } = parsed.data;
  const [budget] = await db
    .insert(budgets)
    .values({ ...rest, userId, limitAmount: limitAmount.toString() })
    .returning();

  return NextResponse.json(budget, { status: 201 });
}
