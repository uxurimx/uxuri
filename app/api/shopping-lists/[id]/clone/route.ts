import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { shoppingLists, shoppingItems, businesses, businessMembers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).max(200).optional(), // si no se pasa, usa "{nombre} (copia)"
});

async function getUserBizIds(userId: string): Promise<string[]> {
  const [owned, member] = await Promise.all([
    db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, userId)),
    db.select({ businessId: businessMembers.businessId }).from(businessMembers).where(eq(businessMembers.userId, userId)),
  ]);
  return [...new Set([...owned.map((b) => b.id), ...member.map((m) => m.businessId)])];
}

async function canAccess(listId: string, userId: string) {
  const [list] = await db.select().from(shoppingLists).where(eq(shoppingLists.id, listId));
  if (!list) return null;
  if (list.userId === userId) return list;
  if (list.businessId) {
    const bizIds = await getUserBizIds(userId);
    if (bizIds.includes(list.businessId)) return list;
  }
  return false;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const source = await canAccess(id, userId);
  if (source === null)  return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (source === false) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  const newName = (parsed.success && parsed.data.name) ? parsed.data.name : `${source.name} (copia)`;

  // Fetch source items
  const sourceItems = await db
    .select()
    .from(shoppingItems)
    .where(eq(shoppingItems.listId, id))
    .orderBy(shoppingItems.sortOrder, shoppingItems.createdAt);

  // Create new list (same businessId — stays in same sharing context)
  const [newList] = await db
    .insert(shoppingLists)
    .values({
      userId,
      businessId: source.businessId,
      name:       newName,
      weekStart:  null,   // no vincula a semana; es plantilla
      status:     "active",
      notes:      source.notes,
    })
    .returning();

  // Copy items with isDone = false
  if (sourceItems.length > 0) {
    await db.insert(shoppingItems).values(
      sourceItems.map((item) => ({
        listId:         newList.id,
        name:           item.name,
        category:       item.category,
        quantity:       item.quantity,
        estimatedPrice: item.estimatedPrice,
        notes:          item.notes,
        isDone:         false,           // siempre sin tachar
        sortOrder:      item.sortOrder,
      }))
    );
  }

  return NextResponse.json({
    list: { ...newList, itemCount: sourceItems.length, doneCount: 0 },
  }, { status: 201 });
}
