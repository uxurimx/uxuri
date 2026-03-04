import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { planningSessions, tasks, projects, objectives } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const createEntitySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("task"),
    data: z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
      dueDate: z.string().optional().nullable(),
    }),
  }),
  z.object({
    type: z.literal("project"),
    data: z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      priority: z.enum(["low", "medium", "high"]).optional(),
    }),
  }),
  z.object({
    type: z.literal("objective"),
    data: z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    }),
  }),
]);

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
  const parsed = createEntitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let created: unknown;

  if (parsed.data.type === "task") {
    const [task] = await db.insert(tasks).values({
      ...parsed.data.data,
      dueDate: parsed.data.data.dueDate ?? null,
      createdBy: userId,
    }).returning();
    created = { type: "task", entity: task };
  } else if (parsed.data.type === "project") {
    const [project] = await db.insert(projects).values({
      ...parsed.data.data,
      createdBy: userId,
    }).returning();
    created = { type: "project", entity: project };
  } else {
    const [objective] = await db.insert(objectives).values({
      ...parsed.data.data,
      createdBy: userId,
    }).returning();
    created = { type: "objective", entity: objective };
  }

  // Update session updatedAt
  await db.update(planningSessions).set({ updatedAt: new Date() }).where(eq(planningSessions.id, id));

  return NextResponse.json(created, { status: 201 });
}
