import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { journalEntries } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const upsertSchema = z.object({
  mood: z.number().int().min(1).max(5).optional().nullable(),
  intention: z.string().optional().nullable(),
  gratitude: z.string().optional().nullable(),
  wins: z.string().optional().nullable(),
  reflection: z.string().optional().nullable(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { date } = await params;
  const [entry] = await db
    .select()
    .from(journalEntries)
    .where(and(eq(journalEntries.userId, userId), eq(journalEntries.date, date)));

  return NextResponse.json(entry ?? null);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { date } = await params;
  const body = await req.json();
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [existing] = await db
    .select({ id: journalEntries.id })
    .from(journalEntries)
    .where(and(eq(journalEntries.userId, userId), eq(journalEntries.date, date)));

  if (existing) {
    const [updated] = await db
      .update(journalEntries)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(journalEntries.userId, userId), eq(journalEntries.date, date)))
      .returning();
    return NextResponse.json(updated);
  } else {
    const [created] = await db
      .insert(journalEntries)
      .values({ userId, date, ...parsed.data })
      .returning();
    return NextResponse.json(created, { status: 201 });
  }
}
