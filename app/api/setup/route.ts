import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * Endpoint de bootstrap: convierte al usuario actual en admin.
 * Solo funciona si no existe ningún admin en la DB.
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Bloquear si ya hay un admin
  const [existingAdmin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"))
    .limit(1);

  if (existingAdmin) {
    return NextResponse.json({ error: "Ya existe un administrador" }, { status: 403 });
  }

  // Promover al usuario actual
  const [updated] = await db
    .update(users)
    .set({ role: "admin", updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Usuario no encontrado en DB" }, { status: 404 });
  }

  // Sincronizar a Clerk para que el JWT se actualice en el próximo login
  const clerk = await clerkClient();
  await clerk.users.updateUserMetadata(userId, { publicMetadata: { role: "admin" } });

  return NextResponse.json({ success: true });
}
