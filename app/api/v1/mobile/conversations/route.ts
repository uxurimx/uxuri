import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/db'
import { mobileConversations, mobileConversationMembers, mobileMessages, mobileProfiles } from '@/db/schema'
import { eq, and, inArray, desc, sql } from 'drizzle-orm'
import { z } from 'zod'

const createSchema = z.object({
  type: z.enum(['dm', 'group']),
  otherUserId: z.string().optional(),
  name: z.string().min(1).max(80).optional(),
  memberIds: z.array(z.string()).optional(),
})

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const memberships = await db
    .select({ conversationId: mobileConversationMembers.conversationId, lastReadAt: mobileConversationMembers.lastReadAt })
    .from(mobileConversationMembers)
    .where(eq(mobileConversationMembers.userId, userId))

  if (!memberships.length) return NextResponse.json([])

  const conversationIds = memberships.map((m) => m.conversationId)
  const conversations = await db
    .select()
    .from(mobileConversations)
    .where(inArray(mobileConversations.id, conversationIds))
    .orderBy(desc(mobileConversations.updatedAt))

  const results = await Promise.all(
    conversations.map(async (conv) => {
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
        .where(eq(mobileConversationMembers.conversationId, conv.id))

      const [lastMessage] = await db
        .select()
        .from(mobileMessages)
        .where(and(eq(mobileMessages.conversationId, conv.id), sql`${mobileMessages.deletedAt} IS NULL`))
        .orderBy(desc(mobileMessages.createdAt))
        .limit(1)

      const myMembership = memberships.find((m) => m.conversationId === conv.id)
      let unreadCount = 0
      if (myMembership?.lastReadAt) {
        const [row] = await db
          .select({ count: sql<number>`count(*)` })
          .from(mobileMessages)
          .where(
            and(
              eq(mobileMessages.conversationId, conv.id),
              sql`${mobileMessages.createdAt} > ${myMembership.lastReadAt}`,
              sql`${mobileMessages.deletedAt} IS NULL`
            )
          )
        unreadCount = Number(row?.count ?? 0)
      }

      return { ...conv, members, lastMessage: lastMessage ?? null, unreadCount }
    })
  )

  return NextResponse.json(results)
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { type, otherUserId, name, memberIds } = parsed.data

  if (type === 'dm') {
    if (!otherUserId) return NextResponse.json({ error: 'otherUserId requerido' }, { status: 400 })

    const myConvs = await db
      .select({ conversationId: mobileConversationMembers.conversationId })
      .from(mobileConversationMembers)
      .where(eq(mobileConversationMembers.userId, userId))

    const theirConvs = await db
      .select({ conversationId: mobileConversationMembers.conversationId })
      .from(mobileConversationMembers)
      .where(eq(mobileConversationMembers.userId, otherUserId))

    const myIds = new Set(myConvs.map((c) => c.conversationId))
    const sharedId = theirConvs.find((c) => myIds.has(c.conversationId))?.conversationId

    if (sharedId) {
      const [existing] = await db.select().from(mobileConversations).where(
        and(eq(mobileConversations.id, sharedId), eq(mobileConversations.type, 'dm'))
      )
      if (existing) return NextResponse.json({ ...existing, members: [], lastMessage: null, unreadCount: 0 })
    }

    const [conv] = await db.insert(mobileConversations).values({ type: 'dm', createdBy: userId }).returning()
    await db.insert(mobileConversationMembers).values([
      { conversationId: conv.id, userId, role: 'owner' as const },
      { conversationId: conv.id, userId: otherUserId, role: 'member' as const },
    ])
    return NextResponse.json({ ...conv, members: [], lastMessage: null, unreadCount: 0 }, { status: 201 })
  }

  if (type === 'group') {
    if (!name) return NextResponse.json({ error: 'name requerido para grupos' }, { status: 400 })
    const [conv] = await db.insert(mobileConversations).values({ type: 'group', name, createdBy: userId }).returning()
    const allMembers = [userId, ...(memberIds ?? [])]
    await db.insert(mobileConversationMembers).values(
      allMembers.map((uid, i) => ({ conversationId: conv.id, userId: uid, role: i === 0 ? 'owner' : 'member' } as const))
    )
    return NextResponse.json({ ...conv, members: [], lastMessage: null, unreadCount: 0 }, { status: 201 })
  }

  return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
}
