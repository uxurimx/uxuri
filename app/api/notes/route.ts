import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { notes } from "@/db/schema";
import { eq, desc, ilike, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().max(255).optional().nullable(),
  content: z.string().default(""),
  tags: z.array(z.string()).optional(),
  color: z.string().optional(),
  isPinned: z.boolean().optional(),
});

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const tag = searchParams.get("tag");

  let query = db.select().from(notes).where(eq(notes.userId, userId)).$dynamic();

  if (q) {
    query = query.where(
      or(
        ilike(notes.title, `%${q}%`),
        ilike(notes.content, `%${q}%`)
      )
    );
  }

  const result = await query.orderBy(desc(notes.isPinned), desc(notes.updatedAt)).limit(100);

  const filtered = tag ? result.filter((n) => n.tags.includes(tag)) : result;
  return NextResponse.json(filtered);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [note] = await db
    .insert(notes)
    .values({ userId, ...parsed.data })
    .returning();

  return NextResponse.json(note, { status: 201 });
}
