import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/db'
import { mobileProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const createSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-z0-9_.]+$/),
  displayName: z.string().min(2).max(50).trim(),
})

const updateSchema = z.object({
  displayName: z.string().min(2).max(50).trim().optional(),
  bio: z.string().max(200).optional(),
  pushToken: z.string().optional(),
  avatarUrl: z.string().url().optional(),
})

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [profile] = await db.select().from(mobileProfiles).where(eq(mobileProfiles.userId, userId))
  if (!profile) return NextResponse.json(null)
  return NextResponse.json(profile)
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const existing = await db.select({ id: mobileProfiles.id })
    .from(mobileProfiles)
    .where(eq(mobileProfiles.username, parsed.data.username))
  if (existing.length > 0) return NextResponse.json({ error: 'Username en uso' }, { status: 409 })

  const [profile] = await db.insert(mobileProfiles).values({
    userId,
    username: parsed.data.username,
    displayName: parsed.data.displayName,
  }).returning()

  return NextResponse.json(profile, { status: 201 })
}

export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const [profile] = await db.update(mobileProfiles)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(mobileProfiles.userId, userId))
    .returning()

  return NextResponse.json(profile)
}
