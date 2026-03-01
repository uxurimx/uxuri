import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users, roles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

const DEFAULT_ROLES = [
  {
    name: "admin",
    label: "Administrador",
    permissions: ["/dashboard", "/clients", "/projects", "/tasks", "/agents", "/users"],
    isDefault: false,
  },
  {
    name: "manager",
    label: "Manager",
    permissions: ["/dashboard", "/clients", "/projects", "/tasks", "/agents"],
    isDefault: false,
  },
  {
    name: "client",
    label: "Cliente",
    permissions: ["/dashboard"],
    isDefault: true,
  },
];

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

  // Crear roles por defecto si no existen
  for (const role of DEFAULT_ROLES) {
    await db.insert(roles).values(role).onConflictDoNothing();
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

  // Sincronizar a Clerk
  const clerk = await clerkClient();
  await clerk.users.updateUserMetadata(userId, { publicMetadata: { role: "admin" } });

  return NextResponse.json({ success: true });
}
