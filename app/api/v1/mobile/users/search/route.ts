import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/db'
import { mobileProfiles } from '@/db/schema'
import { ilike, or, ne, and } from 'drizzle-orm'

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json([])

  const results = await db
    .select({
      userId: mobileProfiles.userId,
      username: mobileProfiles.username,
      displayName: mobileProfiles.displayName,
      avatarUrl: mobileProfiles.avatarUrl,
    })
    .from(mobileProfiles)
    .where(
      and(
        ne(mobileProfiles.userId, userId),
        or(
          ilike(mobileProfiles.username, `%${q}%`),
          ilike(mobileProfiles.displayName, `%${q}%`)
        )
      )
    )
    .limit(20)

  return NextResponse.json(results)
}
