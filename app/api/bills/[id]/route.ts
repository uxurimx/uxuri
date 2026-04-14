import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { bills, businesses, businessMembers } from "@/db/schema";
import { eq, or, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  accountId:   z.string().uuid().optional().nullable(),
  businessId:  z.string().uuid().optional().nullable(),
  name:        z.string().min(1).max(200).optional(),
  amount:      z.number().positive().optional(),
  currency:    z.enum(["MXN", "USD", "EUR", "BTC", "ETH", "USDT", "other"]).optional(),
  frequency:   z.enum(["weekly", "biweekly", "monthly", "bimonthly", "quarterly", "yearly", "once"]).optional(),
  nextDueDate: z.string().optional(),
  category:    z.string().max(50).optional().nullable(),
  isActive:    z.boolean().optional(),
  notes:       z.string().optional().nullable(),
});

async function getUserBizIds(userId: string): Promise<string[]> {
  const [owned, member] = await Promise.all([
    db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, userId)),
    db.select({ businessId: businessMembers.businessId }).from(businessMembers).where(eq(businessMembers.userId, userId)),
  ]);
  return [...new Set([...owned.map((b) => b.id), ...member.map((m) => m.businessId)])];
}

async function canAccess(id: string, userId: string) {
  const [bill] = await db.select().from(bills).where(eq(bills.id, id));
  if (!bill) return null;
  if (bill.userId === userId) return bill;
  if (bill.businessId) {
    const bizIds = await getUserBizIds(userId);
    if (bizIds.includes(bill.businessId)) return bill;
  }
  return false;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const bill = await canAccess(id, userId);
  if (bill === null) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (bill === false) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(bill);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const bill = await canAccess(id, userId);
  if (bill === null) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (bill === false) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { amount, ...rest } = parsed.data;
  const update: Record<string, unknown> = { ...rest, updatedAt: new Date() };
  if (amount !== undefined) update.amount = amount.toString();

  const [updated] = await db
    .update(bills)
    .set(update as never)
    .where(eq(bills.id, id))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const bill = await canAccess(id, userId);
  if (bill === null) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (bill === false) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await db.delete(bills).where(eq(bills.id, id));
  return NextResponse.json({ success: true });
}
