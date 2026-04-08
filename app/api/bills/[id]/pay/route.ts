import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { bills, billPayments, transactions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const paySchema = z.object({
  accountId:  z.string().uuid().optional().nullable(), // override default account
  paidDate:   z.string(),                              // YYYY-MM-DD
  amount:     z.number().positive().optional(),        // override amount
  notes:      z.string().optional().nullable(),
  status:     z.enum(["paid", "skipped"]).optional(),
});

// Advance date by frequency
function advanceDate(dateStr: string, frequency: string): string {
  const d = new Date(dateStr + "T12:00:00");
  switch (frequency) {
    case "weekly":     d.setDate(d.getDate() + 7);   break;
    case "biweekly":   d.setDate(d.getDate() + 14);  break;
    case "monthly":    d.setMonth(d.getMonth() + 1); break;
    case "bimonthly":  d.setMonth(d.getMonth() + 2); break;
    case "quarterly":  d.setMonth(d.getMonth() + 3); break;
    case "yearly":     d.setFullYear(d.getFullYear() + 1); break;
    case "once":       // no advance; deactivate below
      break;
  }
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const [bill] = await db.select().from(bills).where(eq(bills.id, id));
  if (!bill) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (bill.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = paySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { paidDate, notes, status = "paid" } = parsed.data;
  const payAmount = parsed.data.amount ?? parseFloat(bill.amount);
  const accountId = parsed.data.accountId ?? bill.accountId;

  let transactionId: string | null = null;

  // Create transaction automatically if account is set and status is paid
  if (accountId && status === "paid") {
    const [tx] = await db
      .insert(transactions)
      .values({
        userId,
        accountId,
        businessId: bill.businessId,
        type: "expense",
        amount: payAmount.toString(),
        currency: bill.currency,
        category: bill.category,
        description: `${bill.name}`,
        date: paidDate,
        status: "completed",
        notes: notes ?? null,
      })
      .returning({ id: transactions.id });
    transactionId = tx.id;
  }

  // Record payment
  const [payment] = await db
    .insert(billPayments)
    .values({
      billId: id,
      userId,
      paidDate,
      amount: payAmount.toString(),
      currency: bill.currency,
      status,
      transactionId,
      notes: notes ?? null,
    })
    .returning();

  // Advance next due date (or deactivate if once)
  const nextDueDate =
    bill.frequency === "once"
      ? bill.nextDueDate
      : advanceDate(bill.nextDueDate, bill.frequency);

  await db
    .update(bills)
    .set({
      nextDueDate,
      isActive: bill.frequency === "once" ? false : true,
      updatedAt: new Date(),
    })
    .where(eq(bills.id, id));

  return NextResponse.json({ payment, transactionId });
}
