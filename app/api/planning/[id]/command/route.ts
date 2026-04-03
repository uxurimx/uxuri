import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { planningSessions, planningMessages, tasks, projects, objectives, notes } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { PlanningMessageMetadata } from "@/db/schema/planning-messages";

const schema = z.object({
  command: z.enum(["task", "project", "objective", "note"]),
  title: z.string().min(1),
  rawInput: z.string().min(1),
});

const ENTITY_URLS: Record<string, string> = {
  task: "/tasks",
  project: "/projects",
  objective: "/objectives",
  note: "/notes",
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [session] = await db
    .select()
    .from(planningSessions)
    .where(and(eq(planningSessions.id, id), eq(planningSessions.createdBy, userId)));

  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { command, title, rawInput } = parsed.data;

  // Save the slash command as a user message
  await db.insert(planningMessages).values({ sessionId: id, role: "user", content: rawInput });

  // Create the entity
  let entityId = "";
  let entityTitle = title;
  let errorMsg: string | null = null;

  try {
    if (command === "task") {
      const [task] = await db
        .insert(tasks)
        .values({ title, status: "todo", priority: "medium", createdBy: userId })
        .returning();
      entityId = task.id;
      entityTitle = task.title;
    } else if (command === "project") {
      const [project] = await db
        .insert(projects)
        .values({ name: title, status: "planning", createdBy: userId })
        .returning();
      entityId = project.id;
      entityTitle = project.name;
    } else if (command === "objective") {
      const [objective] = await db
        .insert(objectives)
        .values({ title, status: "active", createdBy: userId })
        .returning();
      entityId = objective.id;
      entityTitle = objective.title;
    } else if (command === "note") {
      const [note] = await db
        .insert(notes)
        .values({ title, content: "", userId })
        .returning();
      entityId = note.id;
      entityTitle = note.title ?? title;
    }
  } catch {
    errorMsg = "No pude crear el elemento. Intenta de nuevo.";
  }

  const metadata: PlanningMessageMetadata | undefined = errorMsg
    ? undefined
    : { commandType: command, entityId, entityTitle, url: ENTITY_URLS[command] };

  const [resultMessage] = await db
    .insert(planningMessages)
    .values({
      sessionId: id,
      role: "assistant",
      content: errorMsg ?? entityTitle,
      metadata,
    })
    .returning();

  await db.update(planningSessions).set({ updatedAt: new Date() }).where(eq(planningSessions.id, id));

  return NextResponse.json({ resultMessage });
}
