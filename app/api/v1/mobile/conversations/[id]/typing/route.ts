import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/db'
import { mobileConversationMembers, mobileProfiles } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { pusherServer } from '@/lib/pusher'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: conversationId } = await params
  const { typing } = await req.json() as { typing: boolean }

  const [member] = await db.select({ id: mobileConversationMembers.id })
    .from(mobileConversationMembers)
    .where(and(eq(mobileConversationMembers.conversationId, conversationId), eq(mobileConversationMembers.userId, userId)))

  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [profile] = await db.select({ username: mobileProfiles.username })
    .from(mobileProfiles)
    .where(eq(mobileProfiles.userId, userId))

  await pusherServer.trigger(
    `private-mobile-conversation-${conversationId}`,
    typing ? 'typing:start' : 'typing:stop',
    { userId, username: profile?.username ?? '' }
  )

  return NextResponse.json({ ok: true })
}
