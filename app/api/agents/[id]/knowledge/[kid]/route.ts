import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { agentKnowledge } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().min(1).optional(),
  type: z.enum(["document", "instruction", "character"]).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; kid: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, kid } = await params;

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [updated] = await db
    .update(agentKnowledge)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(agentKnowledge.id, kid), eq(agentKnowledge.agentId, id)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; kid: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, kid } = await params;

  await db
    .delete(agentKnowledge)
    .where(and(eq(agentKnowledge.id, kid), eq(agentKnowledge.agentId, id)));

  return NextResponse.json({ success: true });
}
