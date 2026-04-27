import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { workspaces, workspaceMembers } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { userBelongsToWorkspace } from "@/lib/workspace";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  brandName: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  type: z.enum(["personal", "business"]).optional(),
  isArchived: z.boolean().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  if (!(await userBelongsToWorkspace(userId, id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, id));
  if (!ws) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(ws);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  // Solo el owner puede editar
  const [member] = await db
    .select({ isOwner: workspaceMembers.isOwner })
    .from(workspaceMembers)
    .where(
      and(eq(workspaceMembers.workspaceId, id), eq(workspaceMembers.userId, userId))
    )
    .limit(1);
  if (!member?.isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [updated] = await db
    .update(workspaces)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(workspaces.id, id))
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

  const [ws] = await db
    .select({ ownerId: workspaces.ownerId })
    .from(workspaces)
    .where(eq(workspaces.id, id));
  if (!ws) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ws.ownerId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Soft delete (archivar)
  await db
    .update(workspaces)
    .set({ isArchived: true, updatedAt: new Date() })
    .where(eq(workspaces.id, id));

  return NextResponse.json({ ok: true });
}
