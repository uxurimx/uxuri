import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { workspaceProfiles, workspaceMembers } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  label: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  permissions: z.array(z.string()).optional(),
  sidebarSections: z.array(z.string()).optional(),
  defaultRoute: z.string().optional(),
  sortOrder: z.string().optional(),
});

async function requireOwner(workspaceId: string, userId: string) {
  const [m] = await db
    .select({ isOwner: workspaceMembers.isOwner })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId)
      )
    )
    .limit(1);
  return !!m?.isOwner;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; pid: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, pid } = await params;

  if (!(await requireOwner(id, userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [updated] = await db
    .update(workspaceProfiles)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(
      and(eq(workspaceProfiles.id, pid), eq(workspaceProfiles.workspaceId, id))
    )
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; pid: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, pid } = await params;

  if (!(await requireOwner(id, userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // No permitir borrar perfiles del sistema (Admin etc.)
  const [profile] = await db
    .select({ isSystem: workspaceProfiles.isSystem })
    .from(workspaceProfiles)
    .where(
      and(eq(workspaceProfiles.id, pid), eq(workspaceProfiles.workspaceId, id))
    );
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (profile.isSystem) {
    return NextResponse.json(
      { error: "No se puede eliminar un perfil del sistema" },
      { status: 400 }
    );
  }

  await db
    .delete(workspaceProfiles)
    .where(
      and(eq(workspaceProfiles.id, pid), eq(workspaceProfiles.workspaceId, id))
    );

  return NextResponse.json({ ok: true });
}
