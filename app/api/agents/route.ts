import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { agents, tasks } from "@/db/schema";
import { eq, and, ne, count, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getRole } from "@/lib/auth";

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

  const role = await getRole();
  const isAdmin = role === "admin";

  const baseWhere = eq(agents.isActive, true);
  const whereClause = isAdmin
    ? baseWhere
    : and(baseWhere, or(eq(agents.createdBy, userId), eq(agents.isGlobal, true)));

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
      isGlobal: agents.isGlobal,
      createdAt: agents.createdAt,
      updatedAt: agents.updatedAt,
      taskCount: count(tasks.id),
    })
    .from(agents)
    .leftJoin(tasks, and(eq(tasks.agentId, agents.id), ne(tasks.status, "done")))
    .where(whereClause)
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
    .values({ ...parsed.data, createdBy: userId })
    .returning();

  return NextResponse.json(agent, { status: 201 });
}
