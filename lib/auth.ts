import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users, roles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { canAccessPath } from "@/lib/permissions";

export type Role = string;

export async function getAuthUser() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  return user;
}

/** Devuelve el nombre del rol del usuario actual (JWT → fallback DB). */
export async function getRole(): Promise<string | null> {
  const { userId, sessionClaims } = await auth();
  const claimRole = (sessionClaims?.metadata as { role?: string })?.role;
  if (claimRole) return claimRole;
  if (!userId) return null;
  const [user] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
  return user?.role ?? null;
}

/**
 * Aplica la misma lógica de auto-augmentación de layout.tsx.
 * Centralizado aquí para que tanto layout como requireAccess usen el mismo resultado.
 */
export function augmentPermissions(raw: string[]): string[] {
  let p = [...raw];
  if (p.includes("/tasks") && !p.includes("/agents"))    p = [...p, "/agents"];
  if (p.includes("/projects") && !p.includes("/objectives")) p = [...p, "/objectives"];
  if (p.includes("/objectives") && !p.includes("/planning")) p = [...p, "/planning"];
  if (p.includes("/tasks") && !p.includes("/today"))     p = [...p, "/today"];
  if (p.includes("/tasks") && !p.includes("/habits"))    p = [...p, "/habits"];
  if (p.includes("/tasks") && !p.includes("/journal"))   p = [...p, "/journal"];
  if (p.includes("/tasks") && !p.includes("/notes"))     p = [...p, "/notes"];
  if (p.includes("/tasks") && !p.includes("/schedule"))  p = [...p, "/schedule"];
  if (p.includes("/tasks") && !p.includes("/review"))    p = [...p, "/review"];
  if (p.includes("/clients") && !p.includes("/marketing")) p = [...p, "/marketing"];
  return p;
}

/** Devuelve nombre del rol + permisos del usuario actual (ya augmentados). */
export async function getUserRoleData(): Promise<{ roleName: string; permissions: string[] } | null> {
  const roleName = await getRole();
  if (!roleName) return null;

  const [roleRecord] = await db
    .select({ permissions: roles.permissions })
    .from(roles)
    .where(eq(roles.name, roleName));

  // Fallback: si el rol no está en la tabla, /dashboard siempre visible
  const raw = roleRecord?.permissions ?? ["/dashboard"];
  return { roleName, permissions: augmentPermissions(raw) };
}

/** Redirige a /dashboard si el usuario no tiene acceso al path dado. */
export async function requireAccess(path: string) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const data = await getUserRoleData();
  if (!data || !canAccessPath(data.permissions, path)) {
    redirect("/dashboard");
  }
}

// Backward compat: checkRole/requireRole basados en nombre de rol
export async function checkRole(roleName: string): Promise<boolean> {
  const userRole = await getRole();
  return userRole === roleName;
}

export async function requireRole(roleName: string) {
  const hasRole = await checkRole(roleName);
  if (!hasRole) redirect("/dashboard");
}
