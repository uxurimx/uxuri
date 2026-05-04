import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { transactions, accounts, businesses, businessMembers, clients, projects } from "@/db/schema";
import { eq, or, inArray, and, gte, lte, desc } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureUser } from "@/lib/ensure-user";

const createSchema = z.object({
  accountId: z.string().uuid(),
  toAccountId: z.string().uuid().optional().nullable(),
  businessId: z.string().uuid().optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  type: z.enum(["income", "expense", "transfer"]),
  amount: z.number().positive(),
  toAmount: z.number().positive().optional().nullable(),
  currency: z.enum(["MXN", "USD", "EUR", "BTC", "ETH", "USDT", "other"]).optional(),
  exchangeRateMXN: z.number().optional().nullable(),
  category: z.string().max(50).optional().nullable(),
  description: z.string().min(1).max(500),
  date: z.string(), // ISO date string YYYY-MM-DD
  status: z.enum(["completed", "pending", "cancelled"]).optional(),
  notes: z.string().optional().nullable(),
});

async function getUserAccountIds(userId: string): Promise<string[]> {
  const [owned, member] = await Promise.all([
    db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, userId)),
    db.select({ businessId: businessMembers.businessId }).from(businessMembers).where(eq(businessMembers.userId, userId)),
  ]);
  const bizIds = [...new Set([...owned.map((b) => b.id), ...member.map((m) => m.businessId)])];

  const userAccs = await db.select({ id: accounts.id }).from(accounts).where(
    bizIds.length > 0
      ? or(eq(accounts.userId, userId), inArray(accounts.businessId, bizIds))
      : eq(accounts.userId, userId)
  );
  return userAccs.map((a) => a.id);
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("accountId");
  const type = searchParams.get("type") as "income" | "expense" | "transfer" | null;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const clientId = searchParams.get("clientId");
  const projectId = searchParams.get("projectId");
  const businessId = searchParams.get("businessId");
  const status = searchParams.get("status");
  const limit = parseInt(searchParams.get("limit") ?? "50");
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const accountIds = await getUserAccountIds(userId);
  if (accountIds.length === 0) return NextResponse.json([]);

  // Show transactions where the account is origin (any type) OR destination (transfers only).
  // Expenses/income with toAccountId are only shown from the origin account perspective.
  const baseCondition = or(
    inArray(transactions.accountId, accountIds),
    inArray(transactions.toAccountId, accountIds),
  )!;

  const conditions = [baseCondition];
  if (accountId) conditions.push(
    or(
      eq(transactions.accountId, accountId),
      eq(transactions.toAccountId, accountId),
    )!
  );
  if (type) conditions.push(eq(transactions.type, type));
  if (startDate) conditions.push(gte(transactions.date, startDate));
  if (endDate) conditions.push(lte(transactions.date, endDate));
  if (clientId) conditions.push(eq(transactions.clientId, clientId));
  if (projectId) conditions.push(eq(transactions.projectId, projectId));
  if (businessId) conditions.push(eq(transactions.businessId, businessId));
  if (status) conditions.push(eq(transactions.status, status as "completed" | "pending" | "cancelled"));

  const toAccounts = alias(accounts, "to_accounts");

  const rows = await db
    .select({
      id: transactions.id,
      userId: transactions.userId,
      accountId: transactions.accountId,
      toAccountId: transactions.toAccountId,
      businessId: transactions.businessId,
      clientId: transactions.clientId,
      projectId: transactions.projectId,
      type: transactions.type,
      amount: transactions.amount,
      toAmount: transactions.toAmount,
      currency: transactions.currency,
      exchangeRateMXN: transactions.exchangeRateMXN,
      category: transactions.category,
      description: transactions.description,
      date: transactions.date,
      status: transactions.status,
      notes: transactions.notes,
      createdAt: transactions.createdAt,
      updatedAt: transactions.updatedAt,
      accountName: accounts.name,
      accountIcon: accounts.icon,
      toAccountName: toAccounts.name,
      toAccountIcon: toAccounts.icon,
      clientName: clients.name,
      projectName: projects.name,
    })
    .from(transactions)
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .leftJoin(toAccounts, eq(transactions.toAccountId, toAccounts.id))
    .leftJoin(clients, eq(transactions.clientId, clients.id))
    .leftJoin(projects, eq(transactions.projectId, projects.id))
    .where(and(...conditions))
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureUser(userId);

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Verify the account belongs to this user
  const accountIds = await getUserAccountIds(userId);
  if (!accountIds.includes(parsed.data.accountId)) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const { amount, toAmount, exchangeRateMXN, ...rest } = parsed.data;
  const [tx] = await db
    .insert(transactions)
    .values({
      ...rest,
      userId,
      amount: amount.toString(),
      toAmount: toAmount?.toString() ?? null,
      exchangeRateMXN: exchangeRateMXN?.toString() ?? null,
    })
    .returning();

  return NextResponse.json(tx, { status: 201 });
}
