import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { agentSessions, tasks, agents, taskActivity } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  action: z.enum(["pause", "stop"]),
});

const STATUS_LABELS: Record<string, string> = {
  todo: "Por hacer", in_progress: "En progreso", review: "Revisión", done: "Hecho",
};

function formatDurationShort(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${secs % 60}s`;
}

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

  // Get agent name for logs
  const [agent] = await db.select({ name: agents.name }).from(agents).where(eq(agents.id, session.agentId));
  const agentName = agent?.name ?? "Agente";

  const now = new Date();
  const { action } = parsed.data;

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

    await db.insert(taskActivity).values({
      taskId: session.taskId,
      userId,
      userName: agentName,
      type: "session_paused",
      newValue: String(totalElapsed),
    }).catch(() => {});

    return NextResponse.json(updated);
  }

  // action === "stop"
  const [updated] = await db
    .update(agentSessions)
    .set({ status: "done", endedAt: now, elapsedSeconds: totalElapsed })
    .where(eq(agentSessions.id, id))
    .returning();

  // Get previous task status before updating
  const [task] = await db.select({ status: tasks.status }).from(tasks).where(eq(tasks.id, session.taskId));

  // Mark task as done
  await db.update(tasks).set({ status: "done", updatedAt: now }).where(eq(tasks.id, session.taskId));

  // Log status change (in_progress → done)
  await db.insert(taskActivity).values({
    taskId: session.taskId,
    userId,
    userName: agentName,
    type: "status_changed",
    oldValue: STATUS_LABELS[task?.status ?? "in_progress"] ?? "En progreso",
    newValue: STATUS_LABELS["done"],
  }).catch(() => {});

  // Log session stopped with total time
  await db.insert(taskActivity).values({
    taskId: session.taskId,
    userId,
    userName: agentName,
    type: "session_stopped",
    newValue: String(totalElapsed),
  }).catch(() => {});

  return NextResponse.json(updated);
}
