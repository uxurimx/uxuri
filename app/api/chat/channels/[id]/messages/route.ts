import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { chatMessages, users, chatChannels, agents, agentKnowledge } from "@/db/schema";
import { eq, desc, lt, and, asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { pusherServer } from "@/lib/pusher";
import { sendPushToUser } from "@/lib/web-push";
import { callAI } from "@/lib/ai-call";

const PAGE_SIZE = 50;

const sendSchema = z.object({
  content: z.string().min(1).optional(),
  fileUrl: z.string().url().optional(),
  fileName: z.string().optional(),
  fileType: z.string().optional(),
  fileSize: z.number().int().optional(),
});

function canAccessChannel(channel: { entityType: string; dmKey: string | null }, userId: string) {
  if (channel.entityType !== "direct" && channel.entityType !== "agent-dm") return true;
  return channel.dmKey?.split("|").includes(userId) ?? false;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: channelId } = await params;

  const [channel] = await db
    .select({ entityType: chatChannels.entityType, dmKey: chatChannels.dmKey })
    .from(chatChannels)
    .where(eq(chatChannels.id, channelId));

  if (!channel) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessChannel(channel, userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const before = url.searchParams.get("before");

  const conditions = before
    ? and(eq(chatMessages.channelId, channelId), lt(chatMessages.createdAt, new Date(before)))
    : eq(chatMessages.channelId, channelId);

  const messages = await db
    .select()
    .from(chatMessages)
    .where(conditions)
    .orderBy(desc(chatMessages.createdAt))
    .limit(PAGE_SIZE);

  return NextResponse.json(messages.reverse());
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: channelId } = await params;

  const body = await req.json();
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  if (!parsed.data.content && !parsed.data.fileUrl) {
    return NextResponse.json({ error: "Message must have content or a file" }, { status: 400 });
  }

  // Get sender name + channel info
  const [[sender], [channel]] = await Promise.all([
    db.select({ name: users.name }).from(users).where(eq(users.id, userId)),
    db.select({
      id: chatChannels.id,
      name: chatChannels.name,
      entityType: chatChannels.entityType,
      dmKey: chatChannels.dmKey,
      agentId: chatChannels.agentId,
    }).from(chatChannels).where(eq(chatChannels.id, channelId)),
  ]);
  if (!channel) return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  if (!canAccessChannel(channel, userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [message] = await db
    .insert(chatMessages)
    .values({
      channelId,
      userId,
      userName: sender?.name ?? "Usuario",
      content: parsed.data.content ?? null,
      fileUrl: parsed.data.fileUrl ?? null,
      fileName: parsed.data.fileName ?? null,
      fileType: parsed.data.fileType ?? null,
      fileSize: parsed.data.fileSize ?? null,
    })
    .returning();

  // Real-time: broadcast to everyone subscribed to this channel
  await pusherServer.trigger(`chat-${channelId}`, "message:new", message).catch(() => {});

  // Push notifications for regular DMs
  if (channel.entityType === "direct" && channel.dmKey) {
    const otherUserId = channel.dmKey.split("|").find((id) => id !== userId);
    if (otherUserId) {
      const preview = parsed.data.content
        ? parsed.data.content.slice(0, 100)
        : parsed.data.fileType?.startsWith("audio/")
        ? "🎙️ Nota de voz"
        : parsed.data.fileType?.startsWith("image/")
        ? "📷 Foto"
        : `📎 ${parsed.data.fileName ?? "archivo"}`;

      await sendPushToUser(otherUserId, {
        title: sender?.name ?? "Mensaje directo",
        body: preview,
        url: `/chat?ch=${channelId}`,
        tag: `dm-${channelId}`,
      }).catch(() => {});
    }
  }

  // ── Agent-DM: trigger AI response ────────────────────────────────────────
  if (channel.entityType === "agent-dm" && channel.agentId && parsed.data.content) {
    // Fire-and-forget — don't block the response
    (async () => {
      try {
        const [agent] = await db.select().from(agents).where(eq(agents.id, channel.agentId!));
        if (!agent) return;

        // Signal typing
        await pusherServer
          .trigger(`chat-${channelId}`, "agent:typing", { agentId: agent.id, agentName: agent.name })
          .catch(() => {});

        // Fetch knowledge base
        const knowledge = await db
          .select({ title: agentKnowledge.title, content: agentKnowledge.content, type: agentKnowledge.type })
          .from(agentKnowledge)
          .where(eq(agentKnowledge.agentId, agent.id))
          .orderBy(asc(agentKnowledge.createdAt));

        // Recent history for context (last 20 messages)
        const history = await db
          .select({ userName: chatMessages.userName, content: chatMessages.content, userId: chatMessages.userId })
          .from(chatMessages)
          .where(eq(chatMessages.channelId, channelId))
          .orderBy(desc(chatMessages.createdAt))
          .limit(20);
        const historyText = history.reverse()
          .map((m) => `${m.userName}: ${m.content ?? "[archivo]"}`)
          .join("\n");

        // Build system prompt
        const basePrompt = agent.aiPrompt
          ? agent.aiPrompt
          : `Eres ${agent.name}${agent.specialty ? `, especializado en ${agent.specialty}` : ""}${agent.description ? `. ${agent.description}` : ""}. Eres un asistente IA. Responde de forma concisa y útil en español.`;
        const personalityBlock = agent.personality ? `\n\nPersonalidad:\n${agent.personality}` : "";
        const knowledgeBlock = knowledge.length > 0
          ? "\n\n=== Base de conocimiento ===\n" +
            knowledge.map((k) => `[${k.type}] ${k.title}:\n${k.content}`).join("\n\n") + "\n==="
          : "";
        const systemPrompt = `${basePrompt}${personalityBlock}${knowledgeBlock}`;

        const aiContent = await callAI({
          model: agent.aiModel,
          systemPrompt,
          userMessage: historyText,
          maxTokens: agent.maxTokens,
          temperature: agent.temperature,
        });

        if (aiContent) {
          const [aiMsg] = await db
            .insert(chatMessages)
            .values({ channelId, userId: null, agentId: agent.id, userName: agent.name, content: aiContent })
            .returning();
          await pusherServer.trigger(`chat-${channelId}`, "message:new", aiMsg).catch(() => {});
        }
      } catch (err) {
        process.stderr?.write?.(`[Agent chat error] ${err}\n`);
      } finally {
        await pusherServer
          .trigger(`chat-${channelId}`, "agent:typing-stop", { agentId: channel.agentId })
          .catch(() => {});
      }
    })();
  }

  return NextResponse.json(message, { status: 201 });
}
