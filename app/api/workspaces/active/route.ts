import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import {
  workspaceMembers,
  workspaceMemberProfiles,
  workspaceProfiles,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  ACTIVE_PROFILE_COOKIE,
  ACTIVE_WORKSPACE_COOKIE,
  GLOBAL_MODE_VALUE,
} from "@/lib/workspace";

const bodySchema = z.object({
  workspaceId: z.union([z.string().uuid(), z.literal(GLOBAL_MODE_VALUE)]),
});

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Cambia el workspace activo (cookie). Si el perfil activo actual no pertenece
 * al nuevo workspace, lo reemplaza por el perfil default del usuario en él.
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const cookieStore = await cookies();

  // Modo global: bypassa filtros de workspace y usa rol global completo
  if (parsed.data.workspaceId === GLOBAL_MODE_VALUE) {
    cookieStore.set(ACTIVE_WORKSPACE_COOKIE, GLOBAL_MODE_VALUE, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
    cookieStore.delete(ACTIVE_PROFILE_COOKIE);
    return NextResponse.json({ ok: true, workspaceId: GLOBAL_MODE_VALUE, profileId: null });
  }

  // Verifica que el usuario pertenece al workspace
  const [membership] = await db
    .select({ memberId: workspaceMembers.id })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.userId, userId),
        eq(workspaceMembers.workspaceId, parsed.data.workspaceId)
      )
    )
    .limit(1);

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Resolver perfil default del usuario en este workspace
  const profilesAssigned = await db
    .select({
      profileId: workspaceProfiles.id,
      isDefault: workspaceMemberProfiles.isDefault,
    })
    .from(workspaceMemberProfiles)
    .innerJoin(
      workspaceProfiles,
      eq(workspaceProfiles.id, workspaceMemberProfiles.profileId)
    )
    .where(
      and(
        eq(workspaceMemberProfiles.memberId, membership.memberId),
        eq(workspaceProfiles.workspaceId, parsed.data.workspaceId)
      )
    );

  const defaultProfile =
    profilesAssigned.find((p) => p.isDefault) ?? profilesAssigned[0] ?? null;

  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, parsed.data.workspaceId, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
  if (defaultProfile) {
    cookieStore.set(ACTIVE_PROFILE_COOKIE, defaultProfile.profileId, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
  } else {
    cookieStore.delete(ACTIVE_PROFILE_COOKIE);
  }

  return NextResponse.json({
    ok: true,
    workspaceId: parsed.data.workspaceId,
    profileId: defaultProfile?.profileId ?? null,
  });
}
