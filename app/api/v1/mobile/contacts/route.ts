import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/db'
import { mobileContacts, mobileProfiles } from '@/db/schema'
import { eq, or, and } from 'drizzle-orm'
import { z } from 'zod'

const addSchema = z.object({
  contactId: z.string(),
})

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contacts = await db
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
    .leftJoin(mobileProfiles, eq(mobileProfiles.userId, mobileContacts.contactId))
    .where(and(eq(mobileContacts.userId, userId), eq(mobileContacts.status, 'accepted')))

  return NextResponse.json(contacts)
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = addSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { contactId } = parsed.data
  if (contactId === userId) return NextResponse.json({ error: 'No puedes agregarte a ti mismo' }, { status: 400 })

  const [contact] = await db.insert(mobileContacts)
    .values({ userId, contactId, status: 'pending' })
    .onConflictDoNothing()
    .returning()

  return NextResponse.json(contact ?? { message: 'Ya existe' }, { status: 201 })
}
