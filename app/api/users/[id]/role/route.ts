import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users, roles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { pusherServer } from "@/lib/pusher";
import { canAccessPath } from "@/lib/permissions";
import { getUserRoleData } from "@/lib/auth";

const updateRoleSchema = z.object({
  role: z.string().min(1),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Solo usuarios con acceso a /users pueden cambiar roles
  const callerData = await getUserRoleData();
  if (!callerData || !canAccessPath(callerData.permissions, "/users")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateRoleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Verificar que el rol existe en la DB
  const [roleRecord] = await db
    .select({ name: roles.name })
    .from(roles)
    .where(eq(roles.name, parsed.data.role));

  if (!roleRecord) {
    return NextResponse.json({ error: "Rol no encontrado" }, { status: 400 });
  }

  const [updated] = await db
    .update(users)
    .set({ role: parsed.data.role, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Sincronizar a Clerk publicMetadata
  const clerk = await clerkClient();
  await clerk.users.updateUserMetadata(id, {
    publicMetadata: { role: parsed.data.role },
  });

  // Notificar al usuario via Pusher
  await pusherServer.trigger(`private-user-${id}`, "user:role-changed", {
    role: parsed.data.role,
  });

  return NextResponse.json(updated);
}
