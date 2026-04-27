import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { tasks, projects, users, taskActivity, taskCategoryLinks, taskCategories } from "@/db/schema";
import { ensureUser } from "@/lib/ensure-user";
import { getRole } from "@/lib/auth";
import { eq, or, and, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { pusherServer } from "@/lib/pusher";
import { sendPushToUser } from "@/lib/web-push";
import { resolveNewWorkspaceId, workspaceFilter } from "@/lib/workspace-filter";

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
  categoryIds: z.array(z.string().uuid()).max(4).nullish(),
});

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");

  const role = await getRole();
  const isAdmin = role === "admin";
  const wsFilter = await workspaceFilter(tasks.workspaceId);

  const conditions = [];
  if (projectId) conditions.push(eq(tasks.projectId, projectId));
  if (!isAdmin) {
    conditions.push(or(eq(tasks.createdBy, userId), eq(tasks.assignedTo, userId)));
  }
  if (wsFilter) conditions.push(wsFilter);

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const result = whereClause
    ? await db.select().from(tasks).where(whereClause)
    : await db.select().from(tasks);

  // Fetch categories for all tasks in a single query
  const taskIds = result.map((t) => t.id);
  const categoryMap: Record<string, { id: string; name: string; color: string; icon: string }[]> = {};
  if (taskIds.length > 0) {
    const links = await db
      .select({
        taskId: taskCategoryLinks.taskId,
        id: taskCategories.id,
        name: taskCategories.name,
        color: taskCategories.color,
        icon: taskCategories.icon,
      })
      .from(taskCategoryLinks)
      .innerJoin(taskCategories, eq(taskCategoryLinks.categoryId, taskCategories.id))
      .where(inArray(taskCategoryLinks.taskId, taskIds));

    for (const link of links) {
      if (!categoryMap[link.taskId]) categoryMap[link.taskId] = [];
      categoryMap[link.taskId].push({ id: link.id, name: link.name, color: link.color, icon: link.icon });
    }
  }

  return NextResponse.json(result.map((t) => ({ ...t, categories: categoryMap[t.id] ?? [] })));
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

  const { categoryIds, ...taskData } = parsed.data;
  const workspaceId = await resolveNewWorkspaceId();
  const [task] = await db.insert(tasks).values({
    ...taskData,
    projectId: taskData.projectId ?? null,
    clientId: taskData.clientId ?? null,
    assignedTo: taskData.assignedTo ?? null,
    agentId: taskData.agentId ?? null,
    customColumnId: taskData.customColumnId ?? null,
    dueDate: taskData.dueDate || null,
    energyLevel: taskData.energyLevel ?? null,
    estMinutes: taskData.estMinutes ?? null,
    createdBy: userId,
    workspaceId,
  }).returning();

  if (categoryIds && categoryIds.length > 0) {
    await db.insert(taskCategoryLinks).values(
      categoryIds.map((cid) => ({ taskId: task.id, categoryId: cid }))
    ).onConflictDoNothing();
  }

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
