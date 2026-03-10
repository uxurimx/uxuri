import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { timeSessions } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const startSchema = z.object({
  taskId: z.string().uuid().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  description: z.string().optional().nullable(),
});

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const active = searchParams.get("active");

  if (active === "1") {
    const [session] = await db
      .select()
      .from(timeSessions)
      .where(and(eq(timeSessions.userId, userId), eq(timeSessions.status, "running")))
      .limit(1);
    return NextResponse.json(session ?? null);
  }

  const sessions = await db
    .select()
    .from(timeSessions)
    .where(eq(timeSessions.userId, userId))
    .orderBy(desc(timeSessions.createdAt))
    .limit(50);

  return NextResponse.json(sessions);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = startSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Pause any currently running session
  await db
    .update(timeSessions)
    .set({ status: "paused" })
    .where(and(eq(timeSessions.userId, userId), eq(timeSessions.status, "running")));

  const [session] = await db
    .insert(timeSessions)
    .values({
      userId,
      taskId: parsed.data.taskId ?? null,
      projectId: parsed.data.projectId ?? null,
      description: parsed.data.description ?? null,
      status: "running",
    })
    .returning();

  return NextResponse.json(session, { status: 201 });
}
