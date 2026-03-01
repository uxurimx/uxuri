import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { tasks, users } from "@/db/schema";
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
    .select({ createdBy: tasks.createdBy, assignedTo: tasks.assignedTo, title: tasks.title })
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

  // Notificar al creador cuando el asignado marca como "done"
  if (
    parsed.data.status === "done" &&
    isAssigned &&
    !isCreator &&
    existing.createdBy
  ) {
    const [changer] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
    const completedByName = changer?.name ?? "El usuario asignado";
    const completedUrl = updated.projectId ? `/projects/${updated.projectId}` : "/tasks";
    await Promise.all([
      pusherServer.trigger(`private-user-${existing.createdBy}`, "task:completed", {
        taskId: id,
        taskTitle: existing.title,
        completedByName,
        projectId: updated.projectId,
        url: completedUrl,
      }).catch(() => {}),
      sendPushToUser(existing.createdBy, {
        title: "Tarea completada",
        body: `"${existing.title}" fue marcada como hecha por ${completedByName}`,
        url: updated.projectId ? `/projects/${updated.projectId}` : "/tasks",
        tag: `task-completed-${id}`,
      }).catch(() => {}),
    ]);
  }

  // Notificar cuando se reasigna la tarea
  if (isCreator && parsed.data.assignedTo && parsed.data.assignedTo !== existing.assignedTo && parsed.data.assignedTo !== userId) {
    const [assigner] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
    const assignedByName = assigner?.name ?? "Alguien";
    const assignedUrl = updated.projectId ? `/projects/${updated.projectId}` : "/tasks";
    await Promise.all([
      pusherServer.trigger(`private-user-${parsed.data.assignedTo}`, "task:assigned", {
        taskId: id,
        taskTitle: existing.title,
        assignedByName,
        projectId: updated.projectId,
        url: assignedUrl,
      }).catch(() => {}),
      sendPushToUser(parsed.data.assignedTo, {
        title: "Nueva tarea asignada",
        body: `"${existing.title}" — por ${assignedByName}`,
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
