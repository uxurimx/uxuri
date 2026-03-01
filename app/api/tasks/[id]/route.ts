import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { tasks, users, taskActivity } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { pusherServer } from "@/lib/pusher";
import { sendPushToUser } from "@/lib/web-push";

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  assignedTo: z.string().optional().nullable(),
  status: z.enum(["todo", "in_progress", "review", "done"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  dueDate: z.string().optional().nullable(),
  sortOrder: z.number().int().optional().nullable(),
});

const STATUS_LABELS: Record<string, string> = {
  todo: "Por hacer", in_progress: "En progreso", review: "Revisión", done: "Hecho",
};
const PRIORITY_LABELS: Record<string, string> = {
  low: "Baja", medium: "Media", high: "Alta", urgent: "Urgente",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(task);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [existing] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, id));
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isCreator = !existing.createdBy || existing.createdBy === userId;
  const isAssigned = existing.assignedTo === userId;

  if (!isCreator && !isAssigned) {
    return NextResponse.json({ error: "Solo el creador o el usuario asignado puede modificar esta tarea" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Usuario asignado solo puede cambiar status y sortOrder
  const updateData = isCreator
    ? parsed.data
    : { status: parsed.data.status, sortOrder: parsed.data.sortOrder };

  const [updated] = await db.update(tasks)
    .set({ ...updateData, updatedAt: new Date() })
    .where(eq(tasks.id, id))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Resolve actor name
  const [actor] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
  const actorName = actor?.name ?? "Usuario";

  // Log activity for each changed field
  type ActivityEntry = {
    taskId: string; userId: string; userName: string;
    type: "status_changed" | "priority_changed" | "assigned" | "unassigned" | "title_changed" | "description_changed" | "due_date_changed";
    oldValue?: string | null; newValue?: string | null;
  };
  const activityEntries: ActivityEntry[] = [];

  if (updateData.status && updateData.status !== existing.status) {
    activityEntries.push({
      taskId: id, userId, userName: actorName, type: "status_changed",
      oldValue: STATUS_LABELS[existing.status] ?? existing.status,
      newValue: STATUS_LABELS[updateData.status] ?? updateData.status,
    });
  }

  if (isCreator) {
    if (updateData.priority && updateData.priority !== existing.priority) {
      activityEntries.push({
        taskId: id, userId, userName: actorName, type: "priority_changed",
        oldValue: PRIORITY_LABELS[existing.priority] ?? existing.priority,
        newValue: PRIORITY_LABELS[updateData.priority] ?? updateData.priority,
      });
    }
    if (updateData.title !== undefined && updateData.title !== existing.title) {
      activityEntries.push({
        taskId: id, userId, userName: actorName, type: "title_changed",
        oldValue: existing.title, newValue: updateData.title ?? null,
      });
    }
    if ("description" in updateData && updateData.description !== existing.description) {
      activityEntries.push({
        taskId: id, userId, userName: actorName, type: "description_changed",
        oldValue: existing.description ?? null,
        newValue: updateData.description ?? null,
      });
    }
    if ("dueDate" in updateData && updateData.dueDate !== existing.dueDate) {
      activityEntries.push({
        taskId: id, userId, userName: actorName, type: "due_date_changed",
        oldValue: existing.dueDate ?? null,
        newValue: updateData.dueDate ?? null,
      });
    }
    if ("assignedTo" in updateData && updateData.assignedTo !== existing.assignedTo) {
      if (updateData.assignedTo) {
        const [newAssignee] = await db.select({ name: users.name }).from(users).where(eq(users.id, updateData.assignedTo));
        activityEntries.push({
          taskId: id, userId, userName: actorName, type: "assigned",
          oldValue: null, newValue: newAssignee?.name ?? updateData.assignedTo,
        });
      } else {
        activityEntries.push({
          taskId: id, userId, userName: actorName, type: "unassigned",
          oldValue: null, newValue: null,
        });
      }
    }
  }

  if (activityEntries.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.insert(taskActivity).values(activityEntries as any[]).catch(() => {});
  }

  // Notificar al creador cuando el asignado marca como "done"
  if (
    parsed.data.status === "done" &&
    isAssigned &&
    !isCreator &&
    existing.createdBy
  ) {
    const completedUrl = updated.projectId ? `/projects/${updated.projectId}` : "/tasks";
    await Promise.all([
      pusherServer.trigger(`private-user-${existing.createdBy}`, "task:completed", {
        taskId: id,
        taskTitle: existing.title,
        completedByName: actorName,
        projectId: updated.projectId,
        url: completedUrl,
      }).catch(() => {}),
      sendPushToUser(existing.createdBy, {
        title: "Tarea completada",
        body: `"${existing.title}" fue marcada como hecha por ${actorName}`,
        url: updated.projectId ? `/projects/${updated.projectId}` : "/tasks",
        tag: `task-completed-${id}`,
      }).catch(() => {}),
    ]);
  }

  // Notificar cuando se reasigna la tarea
  if (isCreator && parsed.data.assignedTo && parsed.data.assignedTo !== existing.assignedTo && parsed.data.assignedTo !== userId) {
    const assignedUrl = updated.projectId ? `/projects/${updated.projectId}` : "/tasks";
    await Promise.all([
      pusherServer.trigger(`private-user-${parsed.data.assignedTo}`, "task:assigned", {
        taskId: id,
        taskTitle: existing.title,
        assignedByName: actorName,
        projectId: updated.projectId,
        url: assignedUrl,
      }).catch(() => {}),
      sendPushToUser(parsed.data.assignedTo, {
        title: "Nueva tarea asignada",
        body: `"${existing.title}" — por ${actorName}`,
        url: updated.projectId ? `/projects/${updated.projectId}` : "/tasks",
        tag: `task-assigned-${id}`,
      }).catch(() => {}),
    ]);
  }

  await pusherServer.trigger("tasks-global", "task:updated", updated).catch(() => {});
  if (updated.projectId) {
    await pusherServer.trigger(`project-${updated.projectId}`, "task:updated", updated).catch(() => {});
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [existing] = await db.select({ createdBy: tasks.createdBy, projectId: tasks.projectId }).from(tasks).where(eq(tasks.id, id));
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.createdBy && existing.createdBy !== userId) {
    return NextResponse.json({ error: "Solo el creador puede eliminar esta tarea" }, { status: 403 });
  }

  await db.delete(tasks).where(eq(tasks.id, id));
  await pusherServer.trigger("tasks-global", "task:deleted", { taskId: id, projectId: existing.projectId ?? null }).catch(() => {});
  if (existing.projectId) {
    await pusherServer.trigger(`project-${existing.projectId}`, "task:deleted", { taskId: id }).catch(() => {});
  }
  return NextResponse.json({ success: true });
}
