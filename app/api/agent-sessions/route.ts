import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { agentSessions } from "@/db/schema";
import { eq, and, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  agentId: z.string().uuid(),
  taskId: z.string().uuid(),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { agentId, taskId } = parsed.data;
  const now = new Date();

  // 1. Pause any currently running session for this agent
  const [runningSession] = await db
    .select()
    .from(agentSessions)
    .where(and(eq(agentSessions.agentId, agentId), eq(agentSessions.status, "running")));

  let previousSession = null;
  if (runningSession) {
    const runSeconds = Math.floor((now.getTime() - new Date(runningSession.startedAt).getTime()) / 1000);
    const [paused] = await db
      .update(agentSessions)
      .set({
        status: "paused",
        pausedAt: now,
        elapsedSeconds: runningSession.elapsedSeconds + runSeconds,
      })
      .where(eq(agentSessions.id, runningSession.id))
      .returning();
    previousSession = paused;
  }

  // 2. Check if there's a paused session for this specific task
  const [pausedForTask] = await db
    .select()
    .from(agentSessions)
    .where(
      and(
        eq(agentSessions.agentId, agentId),
        eq(agentSessions.taskId, taskId),
        eq(agentSessions.status, "paused"),
      )
    );

  let session;
  if (pausedForTask) {
    // Resume the existing paused session
    const [resumed] = await db
      .update(agentSessions)
      .set({ status: "running", startedAt: now, pausedAt: null })
      .where(eq(agentSessions.id, pausedForTask.id))
      .returning();
    session = resumed;
  } else {
    // Start a new session
    const [created] = await db
      .insert(agentSessions)
      .values({ agentId, taskId, startedAt: now, elapsedSeconds: 0, status: "running", createdBy: userId })
      .returning();
    session = created;
  }

  return NextResponse.json({ session, previousSession });
}
