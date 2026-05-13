import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/db'
import { mobileContacts, mobileProfiles } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const requests = await db
    .select({
      id: mobileContacts.id,
      userId: mobileContacts.userId,
      contactId: mobileContacts.contactId,
      status: mobileContacts.status,
      createdAt: mobileContacts.createdAt,
      contact: {
        userId: mobileProfiles.userId,
        username: mobileProfiles.username,
        displayName: mobileProfiles.displayName,
        avatarUrl: mobileProfiles.avatarUrl,
      },
    })
    .from(mobileContacts)
    .leftJoin(mobileProfiles, eq(mobileProfiles.userId, mobileContacts.userId))
    .where(and(eq(mobileContacts.contactId, userId), eq(mobileContacts.status, 'pending')))

  return NextResponse.json(requests)
}
