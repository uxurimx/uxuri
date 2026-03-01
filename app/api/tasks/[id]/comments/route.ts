import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { taskComments, users, tasks } from "@/db/schema";
import { eq, asc, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { pusherServer } from "@/lib/pusher";
import { sendPushToUser } from "@/lib/web-push";

const createCommentSchema = z.object({
  content: z.string().min(1),
});

// Extract userIds from @[Name](userId) patterns
function extractMentionedIds(content: string): string[] {
  const regex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const ids: string[] = [];
  let m;
  while ((m = regex.exec(content)) !== null) ids.push(m[2]);
  return [...new Set(ids)];
}

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

  // Get commenter name + the task (for title and projectId)
  const [[commenter], [task]] = await Promise.all([
    db.select({ name: users.name }).from(users).where(eq(users.id, userId)),
    db.select({ title: tasks.title, projectId: tasks.projectId }).from(tasks).where(eq(tasks.id, taskId)),
  ]);

  const commenterName = commenter?.name ?? "Usuario";

  const [comment] = await db
    .insert(taskComments)
    .values({ taskId, userId, userName: commenterName, content: parsed.data.content })
    .returning();

  // Parse @mentions and notify each mentioned user (except self)
  const mentionedIds = extractMentionedIds(parsed.data.content).filter((id) => id !== userId);

  if (mentionedIds.length > 0 && task) {
    const notifUrl = task.projectId ? `/projects/${task.projectId}` : "/tasks";

    // Verify the mentioned users actually exist
    const existingUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.id, mentionedIds));

    const validIds = existingUsers.map((u) => u.id);

    await Promise.all(
      validIds.map((mentionedId) =>
        Promise.all([
          pusherServer
            .trigger(`private-user-${mentionedId}`, "comment:mention", {
              taskId,
              taskTitle: task.title,
              commenterName,
              projectId: task.projectId,
              url: notifUrl,
            })
            .catch(() => {}),
          sendPushToUser(mentionedId, {
            title: `${commenterName} te mencionó`,
            body: `En la tarea: "${task.title}"`,
            url: notifUrl,
            tag: `mention-${taskId}-${comment.id}`,
          }).catch(() => {}),
        ])
      )
    );
  }

  return NextResponse.json(comment, { status: 201 });
}
