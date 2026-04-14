import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { shoppingLists, shoppingItems, businesses, businessMembers } from "@/db/schema";
import { eq, or, inArray, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

async function getUserBizIds(userId: string): Promise<string[]> {
  const [owned, member] = await Promise.all([
    db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, userId)),
    db.select({ businessId: businessMembers.businessId }).from(businessMembers).where(eq(businessMembers.userId, userId)),
  ]);
  return [...new Set([...owned.map((b) => b.id), ...member.map((m) => m.businessId)])];
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json([]);

  const bizIds = await getUserBizIds(userId);

  // Get distinct item names from user's past lists that match the query
  const listsWhere = bizIds.length > 0
    ? or(eq(shoppingLists.userId, userId), inArray(shoppingLists.businessId, bizIds))!
    : eq(shoppingLists.userId, userId);

  // Use raw SQL for DISTINCT ON + ILIKE efficiently
  const rows = await db.execute(sql`
    SELECT DISTINCT ON (LOWER(si.name))
      si.name,
      si.category,
      si.quantity
    FROM shopping_items si
    JOIN shopping_lists sl ON si.list_id = sl.id
    WHERE (${listsWhere})
      AND LOWER(si.name) LIKE ${"%" + q.toLowerCase() + "%"}
    ORDER BY LOWER(si.name), si.created_at DESC
    LIMIT 8
  `);

  return NextResponse.json(rows.rows ?? rows);
}
