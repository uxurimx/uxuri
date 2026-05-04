import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { accounts, businesses, businessMembers } from "@/db/schema";
import { eq, or, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["cash", "bank", "credit", "stripe", "paypal", "crypto", "nomina", "other"]).optional(),
  currency: z.enum(["MXN", "USD", "EUR", "BTC", "ETH", "USDT", "other"]).optional(),
  initialBalance: z.number().optional(),
  icon: z.string().max(10).optional(),
  color: z.string().max(20).optional(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  businessId: z.string().uuid().optional().nullable(),
});

async function canAccess(accountId: string, userId: string) {
  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId));
  if (!account) return { account: null, allowed: false };

  // Personal account — only owner
  if (!account.businessId) {
    return { account, allowed: account.userId === userId };
  }

  // Business account — any business member
  const [membership] = await db
    .select({ id: businessMembers.id })
    .from(businessMembers)
    .where(eq(businessMembers.businessId, account.businessId!));

  const [bizOwner] = await db
    .select({ ownerId: businesses.ownerId })
    .from(businesses)
    .where(eq(businesses.id, account.businessId!));

  const allowed = bizOwner?.ownerId === userId || !!membership;
  return { account, allowed };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { account, allowed } = await canAccess(id, userId);
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(account);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const [account] = await db.select({ userId: accounts.userId }).from(accounts).where(eq(accounts.id, id));
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (account.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { initialBalance, ...rest } = parsed.data;
  const update: Record<string, unknown> = { ...rest, updatedAt: new Date() };
  if (initialBalance !== undefined) update.initialBalance = initialBalance.toString();

  const [updated] = await db.update(accounts).set(update as never).where(eq(accounts.id, id)).returning();
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const [account] = await db.select({ userId: accounts.userId }).from(accounts).where(eq(accounts.id, id));
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (account.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.delete(accounts).where(eq(accounts.id, id));
  return NextResponse.json({ success: true });
}
