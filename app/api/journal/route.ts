import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { journalEntries } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entries = await db
    .select({
      id: journalEntries.id,
      date: journalEntries.date,
      mood: journalEntries.mood,
      intention: journalEntries.intention,
      wins: journalEntries.wins,
    })
    .from(journalEntries)
    .where(eq(journalEntries.userId, userId))
    .orderBy(desc(journalEntries.date))
    .limit(60);

  return NextResponse.json(entries);
}
