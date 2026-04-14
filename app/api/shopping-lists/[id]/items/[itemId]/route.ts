import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { shoppingLists, shoppingItems, businesses, businessMembers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const CATEGORIES = [
  "frutas_verduras","carnes_mariscos","lacteos_huevos","panaderia","bebidas",
  "abarrotes","limpieza","higiene","congelados","farmacia","otro",
] as const;

const patchSchema = z.object({
  name:           z.string().min(1).max(200).optional(),
  category:       z.enum(CATEGORIES).optional(),
  quantity:       z.string().max(50).nullable().optional(),
  estimatedPrice: z.number().positive().nullable().optional(),
  notes:          z.string().nullable().optional(),
  isDone:         z.boolean().optional(),
  sortOrder:      z.number().int().optional(),
});

async function getUserBizIds(userId: string): Promise<string[]> {
  const [owned, member] = await Promise.all([
    db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, userId)),
    db.select({ businessId: businessMembers.businessId }).from(businessMembers).where(eq(businessMembers.userId, userId)),
  ]);
  return [...new Set([...owned.map((b) => b.id), ...member.map((m) => m.businessId)])];
}

async function canAccessList(listId: string, userId: string) {
  const [list] = await db.select().from(shoppingLists).where(eq(shoppingLists.id, listId));
  if (!list) return null;
  if (list.userId === userId) return list;
  if (list.businessId) {
    const bizIds = await getUserBizIds(userId);
    if (bizIds.includes(list.businessId)) return list;
  }
  return false;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, itemId } = await params;
  const access = await canAccessList(id, userId);
  if (access === null)  return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (access === false) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { estimatedPrice, ...rest } = parsed.data;
  const update: Record<string, unknown> = { ...rest, updatedAt: new Date() };
  if (estimatedPrice !== undefined) {
    update.estimatedPrice = estimatedPrice != null ? estimatedPrice.toString() : null;
  }

  const [updated] = await db
    .update(shoppingItems)
    .set(update as never)
    .where(eq(shoppingItems.id, itemId))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, itemId } = await params;
  const access = await canAccessList(id, userId);
  if (access === null)  return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (access === false) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.delete(shoppingItems).where(eq(shoppingItems.id, itemId));
  return NextResponse.json({ ok: true });
}
