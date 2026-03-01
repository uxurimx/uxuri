import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { tasks, users, userTaskPreferences, taskActivity } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { pusherServer } from "@/lib/pusher";

const schema = z.object({
  sortOrder: z.number().int().optional(),
  personalDone: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: taskId } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { sortOrder, personalDone } = parsed.data;

  // Upsert personal preference row
  await db
    .insert(userTaskPreferences)
    .values({ userId, taskId, sortOrder: sortOrder ?? null, personalDone: personalDone ?? false })
    .onConflictDoUpdate({
      target: [userTaskPreferences.userId, userTaskPreferences.taskId],
      set: {
        ...(sortOrder !== undefined && { sortOrder }),
        ...(personalDone !== undefined && { personalDone }),
        updatedAt: new Date(),
      },
    });

  // If marking as personally done, advance global status to "review" to signal the creator
  if (personalDone === true) {
    const [[task], [actor]] = await Promise.all([
      db.select({ status: tasks.status, createdBy: tasks.createdBy, projectId: tasks.projectId, title: tasks.title })
        .from(tasks).where(eq(tasks.id, taskId)),
      db.select({ name: users.name }).from(users).where(eq(users.id, userId)),
    ]);

    if (task && task.status !== "done" && task.status !== "review") {
      const [updated] = await db
        .update(tasks)
        .set({ status: "review", updatedAt: new Date() })
        .where(eq(tasks.id, taskId))
        .returning();

      const actorName = actor?.name ?? "Usuario";

      // Log activity
      await db.insert(taskActivity).values({
        taskId, userId, userName: actorName,
        type: "status_changed",
        oldValue: "En progreso",
        newValue: "Revisión",
      }).catch(() => {});

      // Notify creator that someone marked it as done from their side
      if (task.createdBy && task.createdBy !== userId) {
        const notifUrl = task.projectId ? `/projects/${task.projectId}` : "/tasks";
        await pusherServer.trigger(`private-user-${task.createdBy}`, "task:completed", {
          taskId,
          taskTitle: task.title,
          completedByName: actorName,
          projectId: task.projectId,
          url: notifUrl,
          personalDone: true,
        }).catch(() => {});
      }

      // Broadcast task update for other users
      if (updated) {
        await pusherServer.trigger("tasks-global", "task:updated", updated).catch(() => {});
        if (updated.projectId) {
          await pusherServer.trigger(`project-${updated.projectId}`, "task:updated", updated).catch(() => {});
        }
      }
    }
  }

  return NextResponse.json({ success: true });
}

// Allow undoing personalDone
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: taskId } = await params;

  await db
    .update(userTaskPreferences)
    .set({ personalDone: false, updatedAt: new Date() })
    .where(and(
      eq(userTaskPreferences.userId, userId),
      eq(userTaskPreferences.taskId, taskId),
    ));

  return NextResponse.json({ success: true });
}
