import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { chatMessages, users, chatChannels } from "@/db/schema";
import { eq, desc, lt, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { pusherServer } from "@/lib/pusher";
import { sendPushToUser } from "@/lib/web-push";

const PAGE_SIZE = 50;

const sendSchema = z.object({
  content: z.string().min(1).optional(),
  fileUrl: z.string().url().optional(),
  fileName: z.string().optional(),
  fileType: z.string().optional(),
  fileSize: z.number().int().optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: channelId } = await params;
  const url = new URL(req.url);
  const before = url.searchParams.get("before"); // cursor: ISO timestamp

  const conditions = before
    ? and(eq(chatMessages.channelId, channelId), lt(chatMessages.createdAt, new Date(before)))
    : eq(chatMessages.channelId, channelId);

  const messages = await db
    .select()
    .from(chatMessages)
    .where(conditions)
    .orderBy(desc(chatMessages.createdAt))
    .limit(PAGE_SIZE);

  return NextResponse.json(messages.reverse()); // oldest first
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
    db.select({ id: chatChannels.id, name: chatChannels.name, entityType: chatChannels.entityType, dmKey: chatChannels.dmKey })
      .from(chatChannels).where(eq(chatChannels.id, channelId)),
  ]);
  if (!channel) return NextResponse.json({ error: "Channel not found" }, { status: 404 });

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
  await pusherServer
    .trigger(`chat-${channelId}`, "message:new", message)
    .catch(() => {});

  // Push notifications: ONLY for direct messages, ONLY to the other person
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

  return NextResponse.json(message, { status: 201 });
}
