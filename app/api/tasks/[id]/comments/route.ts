import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { taskComments, users } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const createCommentSchema = z.object({
  content: z.string().min(1),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const comments = await db
    .select()
    .from(taskComments)
    .where(eq(taskComments.taskId, id))
    .orderBy(asc(taskComments.createdAt));

  return NextResponse.json(comments);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: taskId } = await params;

  const body = await req.json();
  const parsed = createCommentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Obtener nombre del usuario desde la DB
  const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
  const userName = user?.name ?? "Usuario";

  const [comment] = await db.insert(taskComments).values({
    taskId,
    userId,
    userName,
    content: parsed.data.content,
  }).returning();

  return NextResponse.json(comment, { status: 201 });
}
