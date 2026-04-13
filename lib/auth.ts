import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users, roles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { canAccessPath } from "@/lib/permissions";

export type Role = string;

/**
 * Construye un objeto con la forma mínima de Clerk User usando datos de la DB.
 * Se usa cuando Clerk API no es alcanzable (offline).
 */
function buildFallbackUser(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    firstName: user.name?.split(" ")[0] ?? "Dev",
    lastName: user.name?.split(" ").slice(1).join(" ") ?? "",
    emailAddresses: [{ emailAddress: user.email ?? "" }],
    imageUrl: user.imageUrl ?? "",
    publicMetadata: { role: user.role },
  } as unknown as Awaited<ReturnType<typeof currentUser>>;
}

export async function getAuthUser() {
  // Intenta Clerk API (funciona online + offline si hay CLERK_JWT_KEY válido)
  try {
    const user = await currentUser();
    if (user) return user;
  } catch {
    // Clerk API no alcanzable: fallback a DB via JWT local
  }

  // JWT verificado localmente con CLERK_JWT_KEY → obtener userId
  let userId: string | null = null;
  try {
    const session = await auth();
    userId = session.userId;
  } catch {
    // JWT también falló (sin sesión activa)
  }

  if (!userId) redirect("/sign-in");

  const [dbUser] = await db.select().from(users).where(eq(users.id, userId!));
  if (!dbUser) redirect("/sign-in");

  console.warn("[auth] 🏠 Clerk offline → usuario cargado desde DB");
  return buildFallbackUser(dbUser);
}

/** Devuelve el nombre del rol del usuario actual (JWT → fallback DB). */
export async function getRole(): Promise<string | null> {
  // auth() con CLERK_JWT_KEY verifica el JWT localmente — funciona offline
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
  if (p.includes("/projects") && !p.includes("/negocios"))  p = [...p, "/negocios"];
  if (p.includes("/projects") && !p.includes("/finanzas"))  p = [...p, "/finanzas"];
  if (p.includes("/projects") && !p.includes("/comidas"))   p = [...p, "/comidas"];
  if (p.includes("/clients") && !p.includes("/marketing"))        p = [...p, "/marketing"];
  if (p.includes("/clients") && !p.includes("/clients/pipeline")) p = [...p, "/clients/pipeline"];
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

export async function checkRole(roleName: string): Promise<boolean> {
  const userRole = await getRole();
  return userRole === roleName;
}

export async function requireRole(roleName: string) {
  const hasRole = await checkRole(roleName);
  if (!hasRole) redirect("/dashboard");
}
