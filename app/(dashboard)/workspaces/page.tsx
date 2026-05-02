import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import {
  workspaceMembers,
  workspaceMemberProfiles,
  workspaceProfiles,
  workspaces,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { WorkspacesManager } from "@/components/workspaces/workspaces-manager";
import { getActiveContext, ACTIVE_WORKSPACE_COOKIE, GLOBAL_MODE_VALUE } from "@/lib/workspace";

export default async function WorkspacesPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // Workspaces del usuario
  const memberships = await db
    .select({
      memberId: workspaceMembers.id,
      isOwner: workspaceMembers.isOwner,
      ws: workspaces,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, userId));

  const ctx = await getActiveContext();
  const cookieStore = await cookies();
  const isGlobalMode = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value === GLOBAL_MODE_VALUE;

  // Para cada workspace traer perfiles + indicar cuáles tiene asignados el user
  const enriched = await Promise.all(
    memberships.map(async (m) => {
      const profilesAll = await db
        .select()
        .from(workspaceProfiles)
        .where(eq(workspaceProfiles.workspaceId, m.ws.id));

      const myProfileIds = (
        await db
          .select({ id: workspaceMemberProfiles.profileId })
          .from(workspaceMemberProfiles)
          .where(eq(workspaceMemberProfiles.memberId, m.memberId))
      ).map((r) => r.id);

      return {
        workspace: m.ws,
        isOwner: m.isOwner,
        memberId: m.memberId,
        profiles: profilesAll,
        myProfileIds,
      };
    })
  );

  return (
    <WorkspacesManager
      data={enriched}
      activeWorkspaceId={ctx?.workspace.id ?? null}
      isGlobalMode={isGlobalMode}
    />
  );

}
