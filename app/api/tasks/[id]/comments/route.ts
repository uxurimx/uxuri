import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { taskComments, users, tasks, taskActivity, agents, agentKnowledge } from "@/db/schema";
import { eq, asc, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { pusherServer } from "@/lib/pusher";
import { sendPushToUser } from "@/lib/web-push";
import { callAI } from "@/lib/ai-call";

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

// Build a readable context block from agent knowledge items
function buildKnowledgeContext(
  items: { title: string; content: string; type: string }[]
): string {
  if (items.length === 0) return "";
  const typeLabel: Record<string, string> = {
    document: "Documento",
    instruction: "Instrucción",
    character: "Personaje",
  };
  return (
    "\n\n=== Base de conocimiento ===\n" +
    items
      .map((k) => `[${typeLabel[k.type] ?? k.type}] ${k.title}:\n${k.content}`)
      .join("\n\n") +
    "\n==="
  );
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

  // Get commenter name + full task context
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

  // Log activity
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

  // Push user comment in real-time
  await pusherServer.trigger(`task-${taskId}`, "comment:created", comment).catch(() => {});

  // Notify mentioned users
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
  if (mentionedAgentIds.length > 0 && task) {
    const mentionedAgents = await db
      .select()
      .from(agents)
      .where(inArray(agents.id, mentionedAgentIds));

    // Fetch all comments for context (includes the one just created)
    const allComments = await db
      .select()
      .from(taskComments)
      .where(eq(taskComments.taskId, taskId))
      .orderBy(asc(taskComments.createdAt));

    for (const agent of mentionedAgents) {
      // Check if we can respond (need at least one AI API key)
      const hasOpenAI = !!process.env.OPENAI_API_KEY;
      const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
      const modelIsAnthropic = agent.aiModel?.startsWith("claude-");
      const canRespond =
        (modelIsAnthropic && hasAnthropic) ||
        (!modelIsAnthropic && hasOpenAI) ||
        (!agent.aiModel && hasOpenAI); // default to OpenAI gpt-4o-mini

      if (!canRespond) continue;

      // Signal typing to frontend
      await pusherServer
        .trigger(`task-${taskId}`, "comment:typing", {
          agentId: agent.id,
          agentName: agent.name,
          agentAvatar: agent.avatar,
        })
        .catch(() => {});

      try {
        // Fetch agent's knowledge base for RAG
        const knowledgeItems = await db
          .select({ title: agentKnowledge.title, content: agentKnowledge.content, type: agentKnowledge.type })
          .from(agentKnowledge)
          .where(eq(agentKnowledge.agentId, agent.id))
          .orderBy(asc(agentKnowledge.createdAt));

        // Build task context
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

        // Build system prompt: aiPrompt → personality → knowledge
        const basePrompt = agent.aiPrompt
          ? agent.aiPrompt
          : `Eres ${agent.name}${agent.specialty ? `, especializado en ${agent.specialty}` : ""}${agent.description ? `. ${agent.description}` : ""}. Eres un asistente IA en una app de gestión de tareas. Responde de forma concisa y útil en español.`;

        const personalityBlock = agent.personality
          ? `\n\nPersonalidad y carácter:\n${agent.personality}`
          : "";

        const knowledgeBlock = buildKnowledgeContext(knowledgeItems);

        const systemPrompt = `${basePrompt}${personalityBlock}${knowledgeBlock}`;

        const userMessage = `Contexto de la tarea:\n${taskContext}\n\nHilo de comentarios:\n${commentHistory}`;

        const aiContent = await callAI({
          model: agent.aiModel,
          systemPrompt,
          userMessage,
          maxTokens: agent.maxTokens,
          temperature: agent.temperature,
        });

        if (aiContent) {
          const [aiComment] = await db
            .insert(taskComments)
            .values({ taskId, userId: null, userName: agent.name, content: aiContent })
            .returning();
          await pusherServer
            .trigger(`task-${taskId}`, "comment:created", aiComment)
            .catch(() => {});
        }
      } catch (err) {
        process.stderr?.write?.(`[AI agent comment error] ${err}\n`);
      }

      // Always stop typing indicator
      await pusherServer
        .trigger(`task-${taskId}`, "comment:typing-stop", { agentId: agent.id })
        .catch(() => {});
    }
  }

  return NextResponse.json(comment, { status: 201 });
}
