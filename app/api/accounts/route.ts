import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { accounts, businesses, businessMembers } from "@/db/schema";
import { eq, or, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureUser } from "@/lib/ensure-user";
import { randomBytes } from "crypto";

function generateWalletAddress(): string {
  return "uxuri-" + randomBytes(4).toString("hex");
}

const createSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["cash", "bank", "credit", "stripe", "paypal", "crypto", "nomina", "other"]).optional(),
  currency: z.enum(["MXN", "USD", "EUR", "BTC", "ETH", "USDT", "other"]).optional(),
  initialBalance: z.number().optional(),
  icon: z.string().max(10).optional(),
  color: z.string().max(20).optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
  businessId: z.string().uuid().optional().nullable(),
});

async function getUserBusinessIds(userId: string): Promise<string[]> {
  const [owned, member] = await Promise.all([
    db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, userId)),
    db.select({ businessId: businessMembers.businessId }).from(businessMembers).where(eq(businessMembers.userId, userId)),
  ]);
  return [...new Set([...owned.map((b) => b.id), ...member.map((m) => m.businessId)])];
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bizIds = await getUserBusinessIds(userId);

  const whereClause =
    bizIds.length > 0
      ? or(eq(accounts.userId, userId), inArray(accounts.businessId, bizIds))
      : eq(accounts.userId, userId);

  const result = await db
    .select()
    .from(accounts)
    .where(whereClause!)
    .orderBy(accounts.createdAt);

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureUser(userId);

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { initialBalance, ...rest } = parsed.data;

  const [account] = await db
    .insert(accounts)
    .values({
      ...rest,
      userId,
      initialBalance: initialBalance?.toString() ?? "0",
      walletAddress: generateWalletAddress(),
    })
    .returning();

  return NextResponse.json(account, { status: 201 });
}
