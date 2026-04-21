import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { agents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  specialty: z.string().optional(),
  description: z.string().optional(),
  avatar: z.string().optional(),
  color: z.string().optional(),
  aiModel: z.string().nullable().optional(),
  aiPrompt: z.string().nullable().optional(),
  personality: z.string().nullable().optional(),
  maxTokens: z.number().int().nullable().optional(),
  tokenBudget: z.number().int().nullable().optional(),
  temperature: z.number().min(0).max(2).nullable().optional(),
  isGlobal: z.boolean().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [agent] = await db.select().from(agents).where(eq(agents.id, id));
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only the creator or admin can view agent config (system prompts, knowledge)
  if (agent.createdBy && agent.createdBy !== userId) {
    const { getRole } = await import("@/lib/auth");
    const role = await getRole();
    if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(agent);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [existing] = await db.select().from(agents).where(eq(agents.id, id));
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { getRole } = await import("@/lib/auth");
  const role = await getRole();
  const isAdmin = role === "admin";

  if (existing.createdBy && existing.createdBy !== userId && !isAdmin) {
    return NextResponse.json({ error: "Solo el creador puede editar este agente" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  // Solo admin puede marcar/desmarcar isGlobal
  if (!isAdmin && parsed.success && parsed.data.isGlobal !== undefined) {
    return NextResponse.json({ error: "Solo admin puede marcar un agente como global" }, { status: 403 });
  }
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [updated] = await db
    .update(agents)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(agents.id, id))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [existing] = await db.select({ createdBy: agents.createdBy }).from(agents).where(eq(agents.id, id));
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.createdBy && existing.createdBy !== userId) {
    return NextResponse.json({ error: "Solo el creador puede eliminar este agente" }, { status: 403 });
  }

  // Soft delete
  await db.update(agents).set({ isActive: false, updatedAt: new Date() }).where(eq(agents.id, id));

  return NextResponse.json({ success: true });
}
