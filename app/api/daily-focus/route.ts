import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { dailyFocus, tasks, projects } from "@/db/schema";
import { eq, and, count } from "drizzle-orm";
import { z } from "zod";
import { todayStr } from "@/lib/date";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? todayStr();

  const rows = await db
    .select({
      focusId: dailyFocus.id,
      taskId: tasks.id,
      sortOrder: dailyFocus.sortOrder,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
      dueDate: tasks.dueDate,
      projectName: projects.name,
    })
    .from(dailyFocus)
    .innerJoin(tasks, eq(dailyFocus.taskId, tasks.id))
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .where(and(eq(dailyFocus.userId, userId), eq(dailyFocus.date, date)))
    .orderBy(dailyFocus.sortOrder, dailyFocus.createdAt);

  return NextResponse.json(rows);
}

const postSchema = z.object({
  taskId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const { taskId, date } = parsed.data;

  const [{ total }] = await db
    .select({ total: count() })
    .from(dailyFocus)
    .where(and(eq(dailyFocus.userId, userId), eq(dailyFocus.date, date)));

  if (total >= 3) {
    return NextResponse.json(
      { error: "Límite de 3 tareas por día alcanzado" },
      { status: 400 }
    );
  }

  const [row] = await db
    .insert(dailyFocus)
    .values({ userId, taskId, date, sortOrder: total })
    .onConflictDoNothing()
    .returning();

  return NextResponse.json(row ?? { ok: true });
}
