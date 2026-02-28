import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export type Role = "admin" | "manager" | "client";

export async function getAuthUser() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  return user;
}

export async function getRole(): Promise<Role | null> {
  const { userId, sessionClaims } = await auth();

  // JWT claim: rápido, no necesita DB (disponible cuando Clerk publicMetadata está sincronizado)
  const claimRole = (sessionClaims?.metadata as { role?: Role })?.role;
  if (claimRole) return claimRole;

  // Fallback a DB: cubre usuarios sin publicMetadata configurado
  if (!userId) return null;
  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId));
  return user?.role ?? null;
}

export async function checkRole(role: Role): Promise<boolean> {
  const userRole = await getRole();
  if (!userRole) return false;
  if (role === "admin") return userRole === "admin";
  if (role === "manager") return userRole === "admin" || userRole === "manager";
  return true;
}

export async function requireRole(role: Role) {
  const hasRole = await checkRole(role);
  if (!hasRole) redirect("/dashboard");
}
