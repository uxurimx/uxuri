import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/db'
import { mobileConversations, mobileConversationMembers, mobileProfiles } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const [membership] = await db
    .select({ id: mobileConversationMembers.id })
    .from(mobileConversationMembers)
    .where(and(eq(mobileConversationMembers.conversationId, id), eq(mobileConversationMembers.userId, userId)))
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [conv] = await db.select().from(mobileConversations).where(eq(mobileConversations.id, id))
  if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const members = await db
    .select({
      id: mobileConversationMembers.id,
      conversationId: mobileConversationMembers.conversationId,
      userId: mobileConversationMembers.userId,
      role: mobileConversationMembers.role,
      joinedAt: mobileConversationMembers.joinedAt,
      lastReadAt: mobileConversationMembers.lastReadAt,
      user: {
        userId: mobileProfiles.userId,
        username: mobileProfiles.username,
        displayName: mobileProfiles.displayName,
        avatarUrl: mobileProfiles.avatarUrl,
      },
    })
    .from(mobileConversationMembers)
    .leftJoin(mobileProfiles, eq(mobileProfiles.userId, mobileConversationMembers.userId))
    .where(eq(mobileConversationMembers.conversationId, id))

  return NextResponse.json({ ...conv, members })
}
