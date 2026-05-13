import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/db'
import { mobileMessages, mobileProfiles } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { pusherServer } from '@/lib/pusher'

const editSchema = z.object({
  content: z.string().min(1).max(4000).trim(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const [message] = await db.select().from(mobileMessages).where(eq(mobileMessages.id, id))

  if (!message) return NextResponse.json({ error: 'Mensaje no encontrado' }, { status: 404 })
  if (message.senderId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (message.deletedAt) return NextResponse.json({ error: 'Mensaje eliminado' }, { status: 400 })

  const body = await req.json()
  const parsed = editSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const [updated] = await db
    .update(mobileMessages)
    .set({ content: parsed.data.content, editedAt: new Date() })
    .where(eq(mobileMessages.id, id))
    .returning()

  const [profile] = await db.select({
    userId: mobileProfiles.userId,
    username: mobileProfiles.username,
    displayName: mobileProfiles.displayName,
    avatarUrl: mobileProfiles.avatarUrl,
  }).from(mobileProfiles).where(eq(mobileProfiles.userId, userId))

  const msgWithSender = { ...updated, sender: profile ?? { userId, username: '', displayName: '', avatarUrl: null } }

  await pusherServer.trigger(
    `private-mobile-conversation-${message.conversationId}`,
    'message:edited',
    { message: msgWithSender }
  )

  return NextResponse.json(msgWithSender)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const [message] = await db.select().from(mobileMessages).where(
    and(eq(mobileMessages.id, id), eq(mobileMessages.senderId, userId))
  )

  if (!message) return NextResponse.json({ error: 'No encontrado o sin permiso' }, { status: 404 })

  await db.update(mobileMessages)
    .set({ deletedAt: new Date(), content: '' })
    .where(eq(mobileMessages.id, id))

  await pusherServer.trigger(
    `private-mobile-conversation-${message.conversationId}`,
    'message:deleted',
    { messageId: id }
  )

  return NextResponse.json({ ok: true })
}
