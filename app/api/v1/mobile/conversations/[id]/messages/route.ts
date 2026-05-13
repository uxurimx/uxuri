import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/db'
import { mobileMessages, mobileConversationMembers, mobileProfiles, mobileConversations, mobileInviteTokens } from '@/db/schema'
import { eq, and, desc, lt, sql } from 'drizzle-orm'
import { z } from 'zod'
import { pusherServer } from '@/lib/pusher'

const sendSchema = z.object({
  content: z.string().min(1).max(4000).trim(),
  type: z.enum(['text']).default('text'),
  replyToId: z.string().uuid().optional(),
})

async function assertMember(conversationId: string, userId: string) {
  const [m] = await db
    .select({ id: mobileConversationMembers.id })
    .from(mobileConversationMembers)
    .where(and(eq(mobileConversationMembers.conversationId, conversationId), eq(mobileConversationMembers.userId, userId)))
  if (!m) throw new Error('Not a member')
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: conversationId } = await params
  try {
    await assertMember(conversationId, userId)
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const before = searchParams.get('before')
  const limit = Math.min(Number(searchParams.get('limit') ?? 40), 100)

  const msgs = await db
    .select({
      id: mobileMessages.id,
      conversationId: mobileMessages.conversationId,
      senderId: mobileMessages.senderId,
      content: mobileMessages.content,
      type: mobileMessages.type,
      fileUrl: mobileMessages.fileUrl,
      fileName: mobileMessages.fileName,
      fileMime: mobileMessages.fileMime,
      fileSize: mobileMessages.fileSize,
      replyToId: mobileMessages.replyToId,
      editedAt: mobileMessages.editedAt,
      deletedAt: mobileMessages.deletedAt,
      createdAt: mobileMessages.createdAt,
      sender: {
        userId: mobileProfiles.userId,
        username: mobileProfiles.username,
        displayName: mobileProfiles.displayName,
        avatarUrl: mobileProfiles.avatarUrl,
      },
    })
    .from(mobileMessages)
    .leftJoin(mobileProfiles, eq(mobileProfiles.userId, mobileMessages.senderId))
    .where(
      and(
        eq(mobileMessages.conversationId, conversationId),
        sql`${mobileMessages.deletedAt} IS NULL`,
        before ? lt(mobileMessages.createdAt, new Date(before)) : undefined
      )
    )
    .orderBy(desc(mobileMessages.createdAt))
    .limit(limit)

  // Mark as read
  await db
    .update(mobileConversationMembers)
    .set({ lastReadAt: new Date() })
    .where(
      and(
        eq(mobileConversationMembers.conversationId, conversationId),
        eq(mobileConversationMembers.userId, userId)
      )
    )

  return NextResponse.json(msgs)
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: conversationId } = await params
  try {
    await assertMember(conversationId, userId)
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = sendSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const [profile] = await db.select().from(mobileProfiles).where(eq(mobileProfiles.userId, userId))

  const [message] = await db.insert(mobileMessages).values({
    conversationId,
    senderId: userId,
    content: parsed.data.content,
    type: parsed.data.type,
    replyToId: parsed.data.replyToId,
  }).returning()

  // Update conversation updatedAt
  await db.update(mobileConversations)
    .set({ updatedAt: new Date() })
    .where(eq(mobileConversations.id, conversationId))

  const msgWithSender = {
    ...message,
    sender: {
      userId,
      username: profile?.username ?? '',
      displayName: profile?.displayName ?? '',
      avatarUrl: profile?.avatarUrl ?? null,
    },
  }

  // Pusher real-time
  await pusherServer.trigger(
    `private-mobile-conversation-${conversationId}`,
    'message:new',
    { message: msgWithSender }
  )

  // Push notifications to other members
  const otherMembers = await db
    .select({ pushToken: mobileProfiles.pushToken })
    .from(mobileConversationMembers)
    .leftJoin(mobileProfiles, eq(mobileProfiles.userId, mobileConversationMembers.userId))
    .where(
      and(
        eq(mobileConversationMembers.conversationId, conversationId),
        sql`${mobileConversationMembers.userId} != ${userId}`,
        sql`${mobileProfiles.pushToken} IS NOT NULL`
      )
    )

  const tokens = otherMembers.map((m) => m.pushToken).filter(Boolean) as string[]
  if (tokens.length > 0) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        tokens.map((token) => ({
          to: token,
          title: profile?.displayName ?? 'Mensaje nuevo',
          body: parsed.data.content.slice(0, 100),
          data: { conversationId },
          sound: 'default',
        }))
      ),
    }).catch(() => {})
  }

  return NextResponse.json(msgWithSender, { status: 201 })
}
