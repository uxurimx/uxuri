import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { agentSessions, tasks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  action: z.enum(["pause", "stop"]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [session] = await db.select().from(agentSessions).where(eq(agentSessions.id, id));
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date();
  const { action } = parsed.data;

  // Compute elapsed seconds for the current run segment
  const runSeconds =
    session.status === "running"
      ? Math.floor((now.getTime() - new Date(session.startedAt).getTime()) / 1000)
      : 0;

  const totalElapsed = session.elapsedSeconds + runSeconds;

  if (action === "pause") {
    const [updated] = await db
      .update(agentSessions)
      .set({ status: "paused", pausedAt: now, elapsedSeconds: totalElapsed })
      .where(eq(agentSessions.id, id))
      .returning();
    return NextResponse.json(updated);
  }

  // action === "stop" — end session and mark task as done
  const [updated] = await db
    .update(agentSessions)
    .set({ status: "done", endedAt: now, elapsedSeconds: totalElapsed })
    .where(eq(agentSessions.id, id))
    .returning();

  // Mark the task as done
  await db
    .update(tasks)
    .set({ status: "done", updatedAt: now })
    .where(eq(tasks.id, session.taskId));

  return NextResponse.json(updated);
}
