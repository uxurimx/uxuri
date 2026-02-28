import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { ensureUser } from "@/lib/ensure-user";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { pusherServer } from "@/lib/pusher";

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullish(),
  projectId: z.string().uuid().nullish(),
  clientId: z.string().uuid().nullish(),
  assignedTo: z.string().nullish(),
  status: z.enum(["todo", "in_progress", "review", "done"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  dueDate: z.string().nullish(),
});

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");

  const query = db.select().from(tasks);
  const result = projectId
    ? await query.where(eq(tasks.projectId, projectId))
    : await query;

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
    dueDate: parsed.data.dueDate || null,
    createdBy: userId,
  }).returning();

  // Trigger Pusher event
  if (task.projectId) {
    await pusherServer.trigger(`project-${task.projectId}`, "task:created", task);
  }

  return NextResponse.json(task, { status: 201 });
}
