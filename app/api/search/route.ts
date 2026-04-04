import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { tasks, projects, notes, objectives } from "@/db/schema";
import { eq, or, ilike, desc, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export type SearchResult = {
  id: string;
  title: string;
  type: "task" | "project" | "note" | "objective";
  status?: string;
  url: string;
};

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json([]);

  const pattern = `%${q}%`;

  const [taskRows, projectRows, noteRows, objectiveRows] = await Promise.all([
    db
      .select({ id: tasks.id, title: tasks.title, status: tasks.status })
      .from(tasks)
      .where(and(or(eq(tasks.createdBy, userId), eq(tasks.assignedTo, userId)), ilike(tasks.title, pattern)))
      .orderBy(desc(tasks.createdAt))
      .limit(5),
    db
      .select({ id: projects.id, name: projects.name, status: projects.status })
      .from(projects)
      .where(and(eq(projects.createdBy, userId), ilike(projects.name, pattern)))
      .orderBy(desc(projects.createdAt))
      .limit(4),
    db
      .select({ id: notes.id, title: notes.title })
      .from(notes)
      .where(and(eq(notes.userId, userId), or(ilike(notes.title, pattern), ilike(notes.content, pattern))))
      .orderBy(desc(notes.updatedAt))
      .limit(4),
    db
      .select({ id: objectives.id, title: objectives.title, status: objectives.status })
      .from(objectives)
      .where(and(eq(objectives.createdBy, userId), ilike(objectives.title, pattern)))
      .orderBy(desc(objectives.createdAt))
      .limit(4),
  ]);

  const results: SearchResult[] = [
    ...taskRows.map((t) => ({ id: t.id, title: t.title, type: "task" as const, status: t.status, url: "/tasks" })),
    ...projectRows.map((p) => ({ id: p.id, title: p.name, type: "project" as const, status: p.status, url: `/projects/${p.id}` })),
    ...noteRows.map((n) => ({ id: n.id, title: n.title ?? "(sin título)", type: "note" as const, url: "/notes" })),
    ...objectiveRows.map((o) => ({ id: o.id, title: o.title, type: "objective" as const, status: o.status, url: `/objectives/${o.id}` })),
  ];

  return NextResponse.json(results);
}
