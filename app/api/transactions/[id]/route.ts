import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { transactions, accounts, businesses, businessMembers } from "@/db/schema";
import { eq, or, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

async function getUserAccountIds(userId: string): Promise<string[]> {
  const [owned, member] = await Promise.all([
    db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, userId)),
    db.select({ businessId: businessMembers.businessId }).from(businessMembers).where(eq(businessMembers.userId, userId)),
  ]);
  const bizIds = [...new Set([...owned.map((b) => b.id), ...member.map((m) => m.businessId)])];
  const accs = await db.select({ id: accounts.id }).from(accounts).where(
    bizIds.length > 0
      ? or(eq(accounts.userId, userId), inArray(accounts.businessId, bizIds))
      : eq(accounts.userId, userId)
  );
  return accs.map((a) => a.id);
}

async function canAccessTx(tx: { userId: string; accountId: string }, userId: string) {
  if (tx.userId === userId) return true;
  const ids = await getUserAccountIds(userId);
  return ids.includes(tx.accountId);
}

const updateSchema = z.object({
  accountId: z.string().uuid().optional(),
  toAccountId: z.string().uuid().optional().nullable(),
  businessId: z.string().uuid().optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  type: z.enum(["income", "expense", "transfer"]).optional(),
  amount: z.number().positive().optional(),
  currency: z.enum(["MXN", "USD", "EUR", "BTC", "ETH", "USDT", "other"]).optional(),
  exchangeRateMXN: z.number().optional().nullable(),
  category: z.string().max(50).optional().nullable(),
  description: z.string().min(1).max(500).optional(),
  date: z.string().optional(),
  status: z.enum(["completed", "pending", "cancelled"]).optional(),
  notes: z.string().optional().nullable(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const [tx] = await db.select().from(transactions).where(eq(transactions.id, id));
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessTx(tx, userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(tx);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const [tx] = await db.select({ userId: transactions.userId, accountId: transactions.accountId }).from(transactions).where(eq(transactions.id, id));
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessTx(tx, userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { amount, exchangeRateMXN, ...rest } = parsed.data;
  const update: Record<string, unknown> = { ...rest, updatedAt: new Date() };
  if (amount !== undefined) update.amount = amount.toString();
  if (exchangeRateMXN !== undefined) update.exchangeRateMXN = exchangeRateMXN?.toString() ?? null;

  const [updated] = await db.update(transactions).set(update as never).where(eq(transactions.id, id)).returning();
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const [tx] = await db.select({ userId: transactions.userId, accountId: transactions.accountId }).from(transactions).where(eq(transactions.id, id));
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canAccessTx(tx, userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await db.delete(transactions).where(eq(transactions.id, id));
  return NextResponse.json({ success: true });
}
