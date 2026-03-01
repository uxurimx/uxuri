import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { agents, tasks } from "@/db/schema";
import { eq, and, ne, count } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const agentSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  specialty: z.string().optional(),
  description: z.string().optional(),
  avatar: z.string().default("🤖"),
  color: z.string().default("#1e3a5f"),
});

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await db
    .select({
      id: agents.id,
      name: agents.name,
      specialty: agents.specialty,
      description: agents.description,
      avatar: agents.avatar,
      color: agents.color,
      createdBy: agents.createdBy,
      isActive: agents.isActive,
      createdAt: agents.createdAt,
      updatedAt: agents.updatedAt,
      taskCount: count(tasks.id),
    })
    .from(agents)
    .leftJoin(tasks, and(eq(tasks.agentId, agents.id), ne(tasks.status, "done")))
    .where(eq(agents.isActive, true))
    .groupBy(agents.id)
    .orderBy(agents.createdAt);

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = agentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [agent] = await db
    .insert(agents)
    .values({
      ...parsed.data,
      createdBy: userId,
    })
    .returning();

  return NextResponse.json(agent, { status: 201 });
}
