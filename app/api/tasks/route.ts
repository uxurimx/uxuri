import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { tasks, projects, users, taskActivity } from "@/db/schema";
import { ensureUser } from "@/lib/ensure-user";
import { getRole } from "@/lib/auth";
import { eq, or, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { pusherServer } from "@/lib/pusher";
import { sendPushToUser } from "@/lib/web-push";

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullish(),
  projectId: z.string().uuid().nullish(),
  clientId: z.string().uuid().nullish(),
  assignedTo: z.string().nullish(),
  agentId: z.string().uuid().nullish(),
  customColumnId: z.string().uuid().nullish(),
  status: z.enum(["todo", "in_progress", "review", "done"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  dueDate: z.string().nullish(),
  energyLevel: z.enum(["low", "medium", "high"]).nullish(),
  estMinutes: z.number().int().positive().nullish(),
  taskType: z.enum(["revenue", "creative", "admin", "strategic", "ops"]).nullish(),
});

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");

  const role = await getRole();
  const isAdmin = role === "admin";

  let result;
  if (projectId) {
    result = isAdmin
      ? await db.select().from(tasks).where(eq(tasks.projectId, projectId))
      : await db.select().from(tasks).where(
          and(
            eq(tasks.projectId, projectId),
            or(eq(tasks.createdBy, userId), eq(tasks.assignedTo, userId))
          )
        );
  } else {
    result = isAdmin
      ? await db.select().from(tasks)
      : await db.select().from(tasks).where(
          or(eq(tasks.createdBy, userId), eq(tasks.assignedTo, userId))
        );
  }

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureUser(userId);

  const body = await req.json();
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [task] = await db.insert(tasks).values({
    ...parsed.data,
    projectId: parsed.data.projectId ?? null,
    clientId: parsed.data.clientId ?? null,
    assignedTo: parsed.data.assignedTo ?? null,
    agentId: parsed.data.agentId ?? null,
    customColumnId: parsed.data.customColumnId ?? null,
    dueDate: parsed.data.dueDate || null,
    energyLevel: parsed.data.energyLevel ?? null,
    estMinutes: parsed.data.estMinutes ?? null,
    taskType: parsed.data.taskType ?? null,
    createdBy: userId,
  }).returning();

  const [creator] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
  const creatorName = creator?.name ?? "Usuario";

  await db.insert(taskActivity).values({
    taskId: task.id,
    userId,
    userName: creatorName,
    type: "created",
  }).catch(() => {});

  if (task.assignedTo && task.assignedTo !== userId) {
    const [creator] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
    const assignedByName = creator?.name ?? "Alguien";
    const taskUrl = task.projectId ? `/projects/${task.projectId}` : "/tasks";
    await Promise.all([
      pusherServer.trigger(`private-user-${task.assignedTo}`, "task:assigned", {
        taskId: task.id,
        taskTitle: task.title,
        assignedByName,
        projectId: task.projectId,
        url: taskUrl,
      }).catch(() => {}),
      sendPushToUser(task.assignedTo, {
        title: "Nueva tarea asignada",
        body: `"${task.title}" — por ${assignedByName}`,
        url: `/projects/${task.projectId ?? ""}`,
        tag: `task-assigned-${task.id}`,
      }).catch(() => {}),
    ]);
  }

  await pusherServer.trigger("tasks-global", "task:created", task).catch(() => {});
  if (task.projectId) {
    await pusherServer.trigger(`project-${task.projectId}`, "task:created", task).catch(() => {});
  }

  return NextResponse.json(task, { status: 201 });
}
