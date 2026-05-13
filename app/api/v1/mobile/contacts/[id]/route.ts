import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/db'
import { mobileContacts } from '@/db/schema'
import { eq, and, or } from 'drizzle-orm'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { action } = await req.json() as { action: 'accept' | 'reject' }

  const [request] = await db
    .select()
    .from(mobileContacts)
    .where(and(eq(mobileContacts.id, id), eq(mobileContacts.contactId, userId)))

  if (!request) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })

  if (action === 'accept') {
    await db.update(mobileContacts)
      .set({ status: 'accepted' })
      .where(eq(mobileContacts.id, id))

    // Create reverse contact entry so both sides see each other
    await db.insert(mobileContacts)
      .values({ userId, contactId: request.userId, status: 'accepted' })
      .onConflictDoNothing()

    return NextResponse.json({ ok: true })
  }

  if (action === 'reject') {
    await db.delete(mobileContacts).where(eq(mobileContacts.id, id))
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  await db.delete(mobileContacts).where(
    and(
      eq(mobileContacts.id, id),
      or(eq(mobileContacts.userId, userId), eq(mobileContacts.contactId, userId))
    )
  )

  return NextResponse.json({ ok: true })
}
