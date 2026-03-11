import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { timeBlocks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(1).max(255),
  taskId: z.string().uuid().optional().nullable(),
  startMinutes: z.number().int().min(0).max(1439),
  endMinutes: z.number().int().min(1).max(1440),
  color: z.string().optional(),
  notes: z.string().optional().nullable(),
});

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const blocks = await db.select().from(timeBlocks)
    .where(and(eq(timeBlocks.userId, userId), eq(timeBlocks.date, date)))
    .orderBy(timeBlocks.startMinutes);

  return NextResponse.json(blocks);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [block] = await db.insert(timeBlocks).values({ userId, ...parsed.data }).returning();
  return NextResponse.json(block, { status: 201 });
}
