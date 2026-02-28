import type { Role } from "./auth";

/**
 * Define qué secciones puede ver cada rol.
 * Modifica este objeto para ajustar permisos sin tocar el resto del código.
 */
export const rolePermissions: Record<Role, string[]> = {
  admin:   ["/dashboard", "/clients", "/projects", "/tasks", "/users"],
  manager: ["/dashboard", "/clients", "/projects", "/tasks"],
  client:  ["/dashboard"],
};

export function canAccessPath(role: Role | null, path: string): boolean {
  if (!role) return false;
  return rolePermissions[role].some(
    (allowed) => path === allowed || path.startsWith(allowed + "/")
  );
}
