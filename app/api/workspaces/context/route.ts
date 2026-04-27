import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import {
  workspaceMembers,
  workspaceMemberProfiles,
  workspaceProfiles,
  workspaces,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getActiveContext } from "@/lib/workspace";

/**
 * Devuelve todo lo que necesita el WorkspaceSwitcher:
 *  - workspaces a los que pertenece el usuario
 *  - perfiles asignados dentro del workspace activo
 *  - workspace + perfil activos actuales
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = await getActiveContext();

  // Workspaces del usuario (no archivados)
  const memberships = await db
    .select({
      memberId: workspaceMembers.id,
      isOwner: workspaceMembers.isOwner,
      ws: workspaces,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, userId));

  const userWorkspaces = memberships
    .filter((m) => !m.ws.isArchived)
    .map((m) => ({
      id: m.ws.id,
      name: m.ws.name,
      slug: m.ws.slug,
      icon: m.ws.icon,
      color: m.ws.color,
      type: m.ws.type,
      isOwner: m.isOwner,
    }));

  // Perfiles disponibles dentro del workspace activo
  let availableProfiles: Array<{
    id: string;
    name: string;
    label: string;
    icon: string | null;
    color: string | null;
    isDefault: boolean;
  }> = [];

  if (ctx) {
    const activeMembership = memberships.find((m) => m.ws.id === ctx.workspace.id);
    if (activeMembership) {
      const rows = await db
        .select({
          profile: workspaceProfiles,
          isDefault: workspaceMemberProfiles.isDefault,
        })
        .from(workspaceMemberProfiles)
        .innerJoin(
          workspaceProfiles,
          eq(workspaceProfiles.id, workspaceMemberProfiles.profileId)
        )
        .where(
          and(
            eq(workspaceMemberProfiles.memberId, activeMembership.memberId),
            eq(workspaceProfiles.workspaceId, ctx.workspace.id)
          )
        );
      availableProfiles = rows.map((r) => ({
        id: r.profile.id,
        name: r.profile.name,
        label: r.profile.label,
        icon: r.profile.icon,
        color: r.profile.color,
        isDefault: r.isDefault,
      }));
    }
  }

  return NextResponse.json({
    activeWorkspace: ctx?.workspace ?? null,
    activeProfile: ctx?.profile ?? null,
    isOwner: ctx?.isOwner ?? false,
    workspaces: userWorkspaces,
    availableProfiles,
  });
}
