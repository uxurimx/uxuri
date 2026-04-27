import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { workspaceProfiles, workspaceMembers, workspaceMemberProfiles } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { userBelongsToWorkspace } from "@/lib/workspace";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  label: z.string().min(1).max(100),
  description: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  permissions: z.array(z.string()).default([]),
  sidebarSections: z.array(z.string()).default([]),
  defaultRoute: z.string().default("/dashboard"),
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

  const list = await db
    .select()
    .from(workspaceProfiles)
    .where(eq(workspaceProfiles.workspaceId, id));
  return NextResponse.json(list);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  // Solo owner crea perfiles
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
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [profile] = await db
    .insert(workspaceProfiles)
    .values({
      ...parsed.data,
      workspaceId: id,
      isSystem: false,
    })
    .returning();

  // Auto-asignar el perfil a todos los miembros actuales del workspace
  const members = await db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, id));

  if (members.length > 0) {
    await db.insert(workspaceMemberProfiles).values(
      members.map((m) => ({
        memberId: m.id,
        profileId: profile.id,
        isDefault: false,
      }))
    ).onConflictDoNothing();
  }

  return NextResponse.json(profile, { status: 201 });
}
