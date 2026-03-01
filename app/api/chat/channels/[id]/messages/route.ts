import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { chatMessages, users, chatChannels, pushSubscriptions } from "@/db/schema";
import { eq, desc, lt, and, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { pusherServer } from "@/lib/pusher";
import webPush from "web-push";

const PAGE_SIZE = 50;

webPush.setVapidDetails(
  "mailto:admin@uxuri.app",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

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

  // Get sender name + verify channel exists
  const [[sender], [channel]] = await Promise.all([
    db.select({ name: users.name }).from(users).where(eq(users.id, userId)),
    db.select({ id: chatChannels.id, name: chatChannels.name }).from(chatChannels).where(eq(chatChannels.id, channelId)),
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

  // Real-time: broadcast to everyone in this channel
  await pusherServer
    .trigger(`chat-${channelId}`, "message:new", message)
    .catch(() => {});

  // Push notifications: send to all other users who have subscriptions
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(ne(pushSubscriptions.userId, userId));

  if (subs.length > 0) {
    const preview = parsed.data.content
      ? parsed.data.content.slice(0, 80)
      : `Envió un archivo: ${parsed.data.fileName ?? "archivo"}`;

    await Promise.allSettled(
      subs.map((sub) =>
        webPush
          .sendNotification(
            { endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } },
            JSON.stringify({
              title: `${sender?.name ?? "Alguien"} en ${channel.name}`,
              body: preview,
              url: `/chat?ch=${channelId}`,
              tag: `chat-${channelId}`,
            })
          )
          .catch(() => {})
      )
    );
  }

  return NextResponse.json(message, { status: 201 });
}
