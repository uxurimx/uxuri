import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { budgets, businesses, businessMembers } from "@/db/schema";
import { eq, or, inArray } from "drizzle-orm";
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

async function getUserBizIds(userId: string): Promise<string[]> {
  const [owned, member] = await Promise.all([
    db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, userId)),
    db.select({ businessId: businessMembers.businessId }).from(businessMembers).where(eq(businessMembers.userId, userId)),
  ]);
  return [...new Set([...owned.map((b) => b.id), ...member.map((m) => m.businessId)])];
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bizIds = await getUserBizIds(userId);

  const rows = await db
    .select()
    .from(budgets)
    .where(
      bizIds.length > 0
        ? or(eq(budgets.userId, userId), inArray(budgets.businessId, bizIds))!
        : eq(budgets.userId, userId)
    )
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
