import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { smokeSessions, smokeCheckins, smokeNotes } from "@/db/schema";
import { eq, desc, and, count, sql } from "drizzle-orm";
import { require420Access, is420Forbidden } from "@/lib/smoke-guard";

const createSchema = z.object({
  type: z.enum(["sativa", "indica", "hybrid", "cbd", "hash", "concentrate"]),
  method: z.enum(["joint", "pipe", "vape", "edible", "bong", "dab"]),
  amount: z.enum(["micro", "low", "medium", "heavy", "very_heavy"]),
  strain: z.string().max(255).optional().nullable(),
  moodBefore: z.number().int().min(1).max(10).optional().nullable(),
});

export async function GET() {
  const guard = await require420Access();
  if (is420Forbidden(guard)) return guard;
  const { userId } = guard;

  const sessions = await db
    .select()
    .from(smokeSessions)
    .where(eq(smokeSessions.userId, userId))
    .orderBy(desc(smokeSessions.startedAt))
    .limit(50);

  // Attach checkin count per session
  const withCounts = await Promise.all(
    sessions.map(async (s) => {
      const [{ checkinCount }] = await db
        .select({ checkinCount: count() })
        .from(smokeCheckins)
        .where(eq(smokeCheckins.sessionId, s.id));
      const [{ noteCount }] = await db
        .select({ noteCount: count() })
        .from(smokeNotes)
        .where(eq(smokeNotes.sessionId, s.id));
      return { ...s, checkinCount: Number(checkinCount), noteCount: Number(noteCount) };
    })
  );

  const active = withCounts.find((s) => s.status === "active") ?? null;
  const closed = withCounts.filter((s) => s.status === "closed");

  return NextResponse.json({ active, sessions: closed });
}

export async function POST(req: Request) {
  const guard = await require420Access();
  if (is420Forbidden(guard)) return guard;
  const { userId } = guard;

  // Close any existing active sessions first
  await db
    .update(smokeSessions)
    .set({ status: "closed", endedAt: new Date() })
    .where(and(eq(smokeSessions.userId, userId), eq(smokeSessions.status, "active")));

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [session] = await db
    .insert(smokeSessions)
    .values({ userId, ...parsed.data })
    .returning();

  return NextResponse.json(session, { status: 201 });
}
