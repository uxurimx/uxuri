import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { smokeNotes, smokeSessions, tasks } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { require420Access, is420Forbidden } from "@/lib/smoke-guard";

const createSchema = z.object({
  content: z.string().min(1),
  type: z.enum(["text", "voice", "insight", "task"]).optional(),
  tags: z.array(z.string()).optional(),
  minutesMark: z.number().int().min(0).optional().nullable(),
  createTask: z.boolean().optional(),
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await require420Access();
  if (is420Forbidden(guard)) return guard;
  const { userId } = guard;
  const { id: sessionId } = await params;

  const [session] = await db
    .select({ id: smokeSessions.id })
    .from(smokeSessions)
    .where(and(eq(smokeSessions.id, sessionId), eq(smokeSessions.userId, userId)));

  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const notes = await db
    .select()
    .from(smokeNotes)
    .where(eq(smokeNotes.sessionId, sessionId))
    .orderBy(asc(smokeNotes.createdAt));

  return NextResponse.json(notes);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await require420Access();
  if (is420Forbidden(guard)) return guard;
  const { userId } = guard;
  const { id: sessionId } = await params;

  const [session] = await db
    .select({ id: smokeSessions.id })
    .from(smokeSessions)
    .where(and(eq(smokeSessions.id, sessionId), eq(smokeSessions.userId, userId)));

  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { createTask, ...noteData } = parsed.data;

  let taskId: string | null = null;

  if (createTask) {
    const [task] = await db
      .insert(tasks)
      .values({
        title: noteData.content.slice(0, 200),
        createdBy: userId,
        assignedTo: userId,
        status: "todo",
        priority: "medium",
      })
      .returning({ id: tasks.id });
    taskId = task.id;
  }

  const [note] = await db
    .insert(smokeNotes)
    .values({
      sessionId,
      userId,
      content: noteData.content,
      type: noteData.type ?? "text",
      tags: noteData.tags,
      minutesMark: noteData.minutesMark ?? null,
      convertedToTask: !!taskId,
      taskId: taskId ?? undefined,
    })
    .returning();

  return NextResponse.json({ note, taskId }, { status: 201 });
}
