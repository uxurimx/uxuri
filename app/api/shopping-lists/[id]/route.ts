import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { shoppingLists, businesses, businessMembers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const patchSchema = z.object({
  name:       z.string().min(1).max(200).optional(),
  businessId: z.string().uuid().nullable().optional(),
  weekStart:  z.string().nullable().optional(),
  status:     z.enum(["active", "done", "archived"]).optional(),
  notes:      z.string().nullable().optional(),
});

async function getUserBizIds(userId: string): Promise<string[]> {
  const [owned, member] = await Promise.all([
    db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, userId)),
    db.select({ businessId: businessMembers.businessId }).from(businessMembers).where(eq(businessMembers.userId, userId)),
  ]);
  return [...new Set([...owned.map((b) => b.id), ...member.map((m) => m.businessId)])];
}

async function canAccess(id: string, userId: string) {
  const [list] = await db.select().from(shoppingLists).where(eq(shoppingLists.id, id));
  if (!list) return null;
  if (list.userId === userId) return list;
  if (list.businessId) {
    const bizIds = await getUserBizIds(userId);
    if (bizIds.includes(list.businessId)) return list;
  }
  return false;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await canAccess(id, userId);
  if (access === null)  return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (access === false) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [updated] = await db
    .update(shoppingLists)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(shoppingLists.id, id))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await canAccess(id, userId);
  if (access === null)  return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (access === false) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.delete(shoppingLists).where(eq(shoppingLists.id, id));
  return NextResponse.json({ ok: true });
}
