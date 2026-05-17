import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { smokeCheckins, smokeSessions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { require420Access, is420Forbidden } from "@/lib/smoke-guard";

const createSchema = z.object({
  minutesMark: z.number().int().min(0),
  intensity: z.number().int().min(1).max(10),
  tags: z.array(z.string()).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await require420Access();
  if (is420Forbidden(guard)) return guard;
  const { userId } = guard;
  const { id: sessionId } = await params;

  const [session] = await db
    .select({ id: smokeSessions.id })
    .from(smokeSessions)
    .where(and(eq(smokeSessions.id, sessionId), eq(smokeSessions.userId, userId)));

  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [checkin] = await db
    .insert(smokeCheckins)
    .values({ sessionId, userId, ...parsed.data })
    .returning();

  return NextResponse.json(checkin, { status: 201 });
}
