import { NextResponse } from "next/server";
import { db } from "@/db";
import { smokeNotes, smokeSessions } from "@/db/schema";
import { eq, desc, and, or } from "drizzle-orm";
import { require420Access, is420Forbidden } from "@/lib/smoke-guard";

export async function GET() {
  const guard = await require420Access();
  if (is420Forbidden(guard)) return guard;
  const { userId } = guard;

  const notes = await db
    .select({
      id: smokeNotes.id,
      sessionId: smokeNotes.sessionId,
      content: smokeNotes.content,
      type: smokeNotes.type,
      tags: smokeNotes.tags,
      minutesMark: smokeNotes.minutesMark,
      convertedToTask: smokeNotes.convertedToTask,
      taskId: smokeNotes.taskId,
      createdAt: smokeNotes.createdAt,
      sessionType: smokeSessions.type,
      sessionStartedAt: smokeSessions.startedAt,
    })
    .from(smokeNotes)
    .innerJoin(smokeSessions, eq(smokeNotes.sessionId, smokeSessions.id))
    .where(eq(smokeNotes.userId, userId))
    .orderBy(desc(smokeNotes.createdAt))
    .limit(500);

  return NextResponse.json(notes);
}
