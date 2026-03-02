import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { taskComments, users, tasks, taskActivity, agents } from "@/db/schema";
import { eq, asc, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { pusherServer } from "@/lib/pusher";
import { sendPushToUser } from "@/lib/web-push";
import OpenAI from "openai";

const createCommentSchema = z.object({
  content: z.string().min(1),
});

// Extract Clerk user IDs from @[Name](userId) — skips agent: prefix
function extractMentionedUserIds(content: string): string[] {
  const regex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const ids: string[] = [];
  let m;
  while ((m = regex.exec(content)) !== null) {
    if (!m[2].startsWith("agent:")) ids.push(m[2]);
  }
  return [...new Set(ids)];
}

// Extract agent IDs from @[Name](agent:agentId)
function extractMentionedAgentIds(content: string): string[] {
  const regex = /@\[([^\]]+)\]\(agent:([^)]+)\)/g;
  const ids: string[] = [];
  let m;
  while ((m = regex.exec(content)) !== null) ids.push(m[2]);
  return [...new Set(ids)];
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const comments = await db
    .select()
    .from(taskComments)
    .where(eq(taskComments.taskId, id))
    .orderBy(asc(taskComments.createdAt));

  return NextResponse.json(comments);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: taskId } = await params;

  const body = await req.json();
  const parsed = createCommentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Get commenter name + the task (for context)
  const [[commenter], [task]] = await Promise.all([
    db.select({ name: users.name }).from(users).where(eq(users.id, userId)),
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        status: tasks.status,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
        projectId: tasks.projectId,
      })
      .from(tasks)
      .where(eq(tasks.id, taskId)),
  ]);

  const commenterName = commenter?.name ?? "Usuario";

  const [comment] = await db
    .insert(taskComments)
    .values({ taskId, userId, userName: commenterName, content: parsed.data.content })
    .returning();

  // Log: comment added
  await db
    .insert(taskActivity)
    .values({
      taskId,
      userId,
      userName: commenterName,
      type: "commented",
      newValue: parsed.data.content.slice(0, 200),
    })
    .catch(() => {});

  // Push user comment so other open sessions see it immediately
  await pusherServer.trigger(`task-${taskId}`, "comment:created", comment).catch(() => {});

  // Notify mentioned users (not agents)
  const mentionedUserIds = extractMentionedUserIds(parsed.data.content).filter((id) => id !== userId);
  if (mentionedUserIds.length > 0 && task) {
    const notifUrl = task.projectId ? `/projects/${task.projectId}` : "/tasks";
    const existingUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.id, mentionedUserIds));
    const validIds = existingUsers.map((u) => u.id);
    await Promise.all(
      validIds.map((mentionedId) =>
        Promise.all([
          pusherServer
            .trigger(`private-user-${mentionedId}`, "comment:mention", {
              taskId,
              taskTitle: task.title,
              commenterName,
              projectId: task.projectId,
              url: notifUrl,
            })
            .catch(() => {}),
          sendPushToUser(mentionedId, {
            title: `${commenterName} te mencionó`,
            body: `En la tarea: "${task.title}"`,
            url: notifUrl,
            tag: `mention-${taskId}-${comment.id}`,
          }).catch(() => {}),
        ])
      )
    );
  }

  // Handle AI agent @mentions
  const mentionedAgentIds = extractMentionedAgentIds(parsed.data.content);
  if (mentionedAgentIds.length > 0 && task && process.env.OPENAI_API_KEY) {
    const mentionedAgents = await db
      .select()
      .from(agents)
      .where(inArray(agents.id, mentionedAgentIds));

    // Fetch all existing comments for context (includes the one just created)
    const allComments = await db
      .select()
      .from(taskComments)
      .where(eq(taskComments.taskId, taskId))
      .orderBy(asc(taskComments.createdAt));

    for (const agent of mentionedAgents) {
      // Signal typing to frontend
      await pusherServer
        .trigger(`task-${taskId}`, "comment:typing", {
          agentId: agent.id,
          agentName: agent.name,
          agentAvatar: agent.avatar,
        })
        .catch(() => {});

      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        // Build task context for the AI
        const taskContext = [
          `Tarea: ${task.title}`,
          task.description ? `Descripción: ${task.description}` : null,
          `Estado: ${task.status}`,
          `Prioridad: ${task.priority}`,
          task.dueDate ? `Fecha límite: ${task.dueDate}` : null,
        ]
          .filter(Boolean)
          .join("\n");

        const commentHistory = allComments
          .map((c) => `${c.userName ?? "Usuario"}: ${c.content}`)
          .join("\n");

        const systemPrompt = agent.aiPrompt
          ? `${agent.aiPrompt}\n\nEres un asistente IA en una aplicación de gestión de tareas. Responde de forma concisa y útil.`
          : `Eres ${agent.name}${agent.specialty ? `, especializado en ${agent.specialty}` : ""}${agent.description ? `. ${agent.description}` : ""}. Eres un asistente IA en una app de gestión de tareas. Responde de forma concisa y útil en español.`;

        const userMessage = `Contexto de la tarea:\n${taskContext}\n\nHilo de comentarios:\n${commentHistory}`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          max_tokens: 500,
        });

        const aiContent = response.choices[0]?.message?.content?.trim();
        if (aiContent) {
          const [aiComment] = await db
            .insert(taskComments)
            .values({ taskId, userId: null, userName: agent.name, content: aiContent })
            .returning();
          await pusherServer
            .trigger(`task-${taskId}`, "comment:created", aiComment)
            .catch(() => {});
        }
      } catch {
        // OpenAI call failed — typing indicator will be cleared below
      }

      // Always stop typing indicator
      await pusherServer
        .trigger(`task-${taskId}`, "comment:typing-stop", { agentId: agent.id })
        .catch(() => {});
    }
  }

  return NextResponse.json(comment, { status: 201 });
}
