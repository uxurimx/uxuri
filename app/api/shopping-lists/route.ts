import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { shoppingLists, shoppingItems, businesses, businessMembers } from "@/db/schema";
import { eq, or, inArray, desc, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ensureUser } from "@/lib/ensure-user";

const createSchema = z.object({
  name:       z.string().min(1).max(200),
  businessId: z.string().uuid().nullable().optional(),
  weekStart:  z.string().nullable().optional(),
  notes:      z.string().nullable().optional(),
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
    .select({
      id:         shoppingLists.id,
      userId:     shoppingLists.userId,
      businessId: shoppingLists.businessId,
      name:       shoppingLists.name,
      weekStart:  shoppingLists.weekStart,
      status:     shoppingLists.status,
      notes:      shoppingLists.notes,
      createdAt:  shoppingLists.createdAt,
      updatedAt:  shoppingLists.updatedAt,
      itemCount:  sql<number>`(SELECT COUNT(*)::int FROM shopping_items WHERE list_id = ${shoppingLists.id})`,
      doneCount:  sql<number>`(SELECT COUNT(*)::int FROM shopping_items WHERE list_id = ${shoppingLists.id} AND is_done = true)`,
    })
    .from(shoppingLists)
    .where(
      bizIds.length > 0
        ? or(eq(shoppingLists.userId, userId), inArray(shoppingLists.businessId, bizIds))!
        : eq(shoppingLists.userId, userId)
    )
    .orderBy(desc(shoppingLists.updatedAt));

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureUser(userId);

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [list] = await db
    .insert(shoppingLists)
    .values({
      userId,
      name:       parsed.data.name,
      businessId: parsed.data.businessId ?? null,
      weekStart:  parsed.data.weekStart ?? null,
      notes:      parsed.data.notes ?? null,
    })
    .returning();

  return NextResponse.json({ ...list, itemCount: 0, doneCount: 0 }, { status: 201 });
}
