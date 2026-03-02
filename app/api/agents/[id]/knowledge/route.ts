import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { agentKnowledge, agents } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  type: z.enum(["document", "instruction", "character"]).default("document"),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const items = await db
    .select()
    .from(agentKnowledge)
    .where(eq(agentKnowledge.agentId, id))
    .orderBy(asc(agentKnowledge.createdAt));

  return NextResponse.json(items);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [agent] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(eq(agents.id, id));
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [item] = await db
    .insert(agentKnowledge)
    .values({ agentId: id, ...parsed.data })
    .returning();

  return NextResponse.json(item, { status: 201 });
}
