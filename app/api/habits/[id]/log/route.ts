import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { habitLogs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: habitId } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [log] = await db
    .insert(habitLogs)
    .values({ habitId, userId, date: parsed.data.date })
    .onConflictDoNothing()
    .returning();

  return NextResponse.json(log ?? { habitId, date: parsed.data.date }, { status: 201 });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: habitId } = await params;
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  await db
    .delete(habitLogs)
    .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.userId, userId), eq(habitLogs.date, date)));

  return NextResponse.json({ success: true });
}
