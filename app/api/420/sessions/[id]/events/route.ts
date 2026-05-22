import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { smokeEvents, smokeSessions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { require420Access, is420Forbidden } from "@/lib/smoke-guard";

const postSchema = z.object({
  minutesMark: z.number().int().min(0),
  notes: z.string().max(500).optional().nullable(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await require420Access();
  if (is420Forbidden(guard)) return guard;
  const { userId } = guard;
  const { id } = await params;

  const events = await db
    .select()
    .from(smokeEvents)
    .where(and(eq(smokeEvents.sessionId, id), eq(smokeEvents.userId, userId)));

  return NextResponse.json(events);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await require420Access();
  if (is420Forbidden(guard)) return guard;
  const { userId } = guard;
  const { id } = await params;

  // Verify session ownership
  const [session] = await db
    .select({ id: smokeSessions.id })
    .from(smokeSessions)
    .where(and(eq(smokeSessions.id, id), eq(smokeSessions.userId, userId)))
    .limit(1);
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [event] = await db
    .insert(smokeEvents)
    .values({ sessionId: id, userId, ...parsed.data })
    .returning();

  return NextResponse.json(event, { status: 201 });
}
