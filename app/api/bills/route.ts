import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { bills } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureUser } from "@/lib/ensure-user";

const createSchema = z.object({
  accountId:    z.string().uuid().optional().nullable(),
  businessId:   z.string().uuid().optional().nullable(),
  name:         z.string().min(1).max(200),
  amount:       z.number().positive(),
  currency:     z.enum(["MXN", "USD", "EUR", "BTC", "ETH", "USDT", "other"]).optional(),
  frequency:    z.enum(["weekly", "biweekly", "monthly", "bimonthly", "quarterly", "yearly", "once"]).optional(),
  nextDueDate:  z.string(), // YYYY-MM-DD
  category:     z.string().max(50).optional().nullable(),
  notes:        z.string().optional().nullable(),
});

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(bills)
    .where(eq(bills.userId, userId))
    .orderBy(bills.nextDueDate);

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureUser(userId);

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { amount, ...rest } = parsed.data;
  const [bill] = await db
    .insert(bills)
    .values({ ...rest, userId, amount: amount.toString() })
    .returning();

  return NextResponse.json(bill, { status: 201 });
}
