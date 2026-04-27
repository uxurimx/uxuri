import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import {
  workspaces,
  workspaceMembers,
  workspaceProfiles,
  workspaceMemberProfiles,
  type Workspace,
  type WorkspaceProfile,
} from "@/db/schema";

export const ACTIVE_WORKSPACE_COOKIE = "uxuri_workspace_id";
export const ACTIVE_PROFILE_COOKIE = "uxuri_profile_id";
export const GLOBAL_MODE_VALUE = "global";

export interface ActiveContext {
  workspace: Workspace;
  profile: WorkspaceProfile | null;
  isOwner: boolean;
}

/**
 * Devuelve los workspaces a los que el usuario actual pertenece.
 */
export async function getUserWorkspaces(userId: string): Promise<Workspace[]> {
  const rows = await db
    .select({ ws: workspaces })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, userId));
  return rows.map((r) => r.ws).filter((w) => !w.isArchived);
}

/**
 * Resuelve el contexto activo: workspace y perfil seleccionados.
 * Si no hay cookie válida, cae al primer workspace + perfil default del usuario.
 */
export async function getActiveContext(): Promise<ActiveContext | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const cookieStore = await cookies();
  const wsCookie = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value ?? null;
  const profileCookie = cookieStore.get(ACTIVE_PROFILE_COOKIE)?.value ?? null;

  // Modo global: admin ve todos los datos sin filtro de workspace
  if (wsCookie === GLOBAL_MODE_VALUE) return null;

  // 1. Workspaces del usuario
  const memberships = await db
    .select({
      memberId: workspaceMembers.id,
      isOwner: workspaceMembers.isOwner,
      ws: workspaces,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, userId));

  if (memberships.length === 0) return null;

  // 2. Elegir workspace activo: cookie válida si pertenece, si no el primero
  let active = memberships.find((m) => m.ws.id === wsCookie && !m.ws.isArchived);
  if (!active) {
    active = memberships.find((m) => !m.ws.isArchived) ?? memberships[0];
  }

  // 3. Perfiles asignados al member dentro de ese workspace
  const profilesAssigned = await db
    .select({
      mp: workspaceMemberProfiles,
      profile: workspaceProfiles,
    })
    .from(workspaceMemberProfiles)
    .innerJoin(
      workspaceProfiles,
      eq(workspaceProfiles.id, workspaceMemberProfiles.profileId)
    )
    .where(
      and(
        eq(workspaceMemberProfiles.memberId, active.memberId),
        eq(workspaceProfiles.workspaceId, active.ws.id)
      )
    );

  // 4. Elegir perfil activo: cookie válida, si no isDefault, si no el primero
  let profile: WorkspaceProfile | null = null;
  if (profilesAssigned.length > 0) {
    const fromCookie = profilesAssigned.find((p) => p.profile.id === profileCookie);
    const fromDefault = profilesAssigned.find((p) => p.mp.isDefault);
    profile = (fromCookie ?? fromDefault ?? profilesAssigned[0]).profile;
  }

  return {
    workspace: active.ws,
    profile,
    isOwner: active.isOwner,
  };
}

/**
 * Atajo: solo el ID del workspace activo. Útil para filtrar queries.
 * Devuelve null si el usuario no tiene workspace asociado.
 */
export async function getActiveWorkspaceId(): Promise<string | null> {
  const ctx = await getActiveContext();
  return ctx?.workspace.id ?? null;
}

/**
 * Verifica que el usuario tenga acceso al workspace dado.
 * Útil cuando llega un :id por params en una API.
 */
export async function userBelongsToWorkspace(
  userId: string,
  workspaceId: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.userId, userId),
        eq(workspaceMembers.workspaceId, workspaceId)
      )
    )
    .limit(1);
  return !!row;
}
