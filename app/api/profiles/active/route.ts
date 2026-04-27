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
import { ACTIVE_PROFILE_COOKIE } from "@/lib/workspace";

const bodySchema = z.object({
  profileId: z.string().uuid(),
});

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Cambia el perfil activo (cookie). Verifica que el perfil esté asignado al
 * usuario en el workspace al que pertenece.
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Verificar que el perfil está asignado al usuario
  const [row] = await db
    .select({ profileId: workspaceMemberProfiles.profileId })
    .from(workspaceMemberProfiles)
    .innerJoin(
      workspaceMembers,
      eq(workspaceMembers.id, workspaceMemberProfiles.memberId)
    )
    .innerJoin(
      workspaceProfiles,
      eq(workspaceProfiles.id, workspaceMemberProfiles.profileId)
    )
    .where(
      and(
        eq(workspaceMembers.userId, userId),
        eq(workspaceMemberProfiles.profileId, parsed.data.profileId)
      )
    )
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_PROFILE_COOKIE, parsed.data.profileId, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
  });

  return NextResponse.json({ ok: true, profileId: parsed.data.profileId });
}
