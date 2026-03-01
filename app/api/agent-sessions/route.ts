import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { agentSessions, tasks, agents, taskActivity } from "@/db/schema";
import { eq, and, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const STATUS_LABELS: Record<string, string> = {
  todo: "Por hacer", in_progress: "En progreso", review: "Revisión", done: "Hecho",
};

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

  // Get agent info for activity log
  const [agent] = await db.select({ name: agents.name }).from(agents).where(eq(agents.id, agentId));
  const agentName = agent?.name ?? "Agente";

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
      .set({ status: "paused", pausedAt: now, elapsedSeconds: runningSession.elapsedSeconds + runSeconds })
      .where(eq(agentSessions.id, runningSession.id))
      .returning();
    previousSession = paused;

    // Log pause for the previous task
    await db.insert(taskActivity).values({
      taskId: runningSession.taskId,
      userId,
      userName: agentName,
      type: "session_paused",
      newValue: String(runningSession.elapsedSeconds + runSeconds),
    }).catch(() => {});
  }

  // 2. Get current task info
  const [task] = await db.select({ status: tasks.status }).from(tasks).where(eq(tasks.id, taskId));

  // 3. Auto-update task status to "in_progress" if it's todo/review
  const needsStatusChange = task && (task.status === "todo" || task.status === "review");
  if (needsStatusChange) {
    await db.update(tasks).set({ status: "in_progress", updatedAt: now }).where(eq(tasks.id, taskId));

    // Log status change
    await db.insert(taskActivity).values({
      taskId,
      userId,
      userName: agentName,
      type: "status_changed",
      oldValue: STATUS_LABELS[task.status] ?? task.status,
      newValue: STATUS_LABELS["in_progress"],
    }).catch(() => {});
  }

  // 4. Check for paused session for this task
  const [pausedForTask] = await db
    .select()
    .from(agentSessions)
    .where(and(
      eq(agentSessions.agentId, agentId),
      eq(agentSessions.taskId, taskId),
      eq(agentSessions.status, "paused"),
    ));

  let session;
  if (pausedForTask) {
    const [resumed] = await db
      .update(agentSessions)
      .set({ status: "running", startedAt: now, pausedAt: null })
      .where(eq(agentSessions.id, pausedForTask.id))
      .returning();
    session = resumed;
  } else {
    const [created] = await db
      .insert(agentSessions)
      .values({ agentId, taskId, startedAt: now, elapsedSeconds: 0, status: "running", createdBy: userId })
      .returning();
    session = created;
  }

  // 5. Log session_started
  await db.insert(taskActivity).values({
    taskId,
    userId,
    userName: agentName,
    type: "session_started",
    newValue: agentName,
  }).catch(() => {});

  return NextResponse.json({ session, previousSession });
}
