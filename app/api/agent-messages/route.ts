import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { agentMessages } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { pusherServer } from "@/lib/pusher";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const taskId = searchParams.get("taskId");
  if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });

  const messages = await db
    .select()
    .from(agentMessages)
    .where(eq(agentMessages.taskId, taskId))
    .orderBy(asc(agentMessages.createdAt));

  return NextResponse.json(messages);
}

const postSchema = z.object({
  taskId: z.string().uuid(),
  content: z.string().min(1),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { taskId, content } = parsed.data;

  const [message] = await db
    .insert(agentMessages)
    .values({ taskId, role: "user", content })
    .returning();

  await pusherServer.trigger(`task-${taskId}`, "agent:message", message).catch(() => {});

  return NextResponse.json(message, { status: 201 });
}
