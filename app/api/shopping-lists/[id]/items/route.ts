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

const createSchema = z.object({
  name:           z.string().min(1).max(200),
  category:       z.enum(CATEGORIES).default("otro"),
  quantity:       z.string().max(50).nullable().optional(),
  estimatedPrice: z.number().positive().nullable().optional(),
  notes:          z.string().nullable().optional(),
  sortOrder:      z.number().int().optional(),
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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await canAccess(id, userId);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const items = await db
    .select()
    .from(shoppingItems)
    .where(eq(shoppingItems.listId, id))
    .orderBy(shoppingItems.sortOrder, shoppingItems.createdAt);

  return NextResponse.json(items);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await canAccess(id, userId);
  if (access === null)  return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (access === false) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { estimatedPrice, ...rest } = parsed.data;

  const [item] = await db
    .insert(shoppingItems)
    .values({
      listId: id,
      ...rest,
      estimatedPrice: estimatedPrice != null ? estimatedPrice.toString() : null,
    })
    .returning();

  // Bump list updatedAt so it floats to top
  await db
    .update(shoppingLists)
    .set({ updatedAt: new Date() })
    .where(eq(shoppingLists.id, id));

  return NextResponse.json(item, { status: 201 });
}
