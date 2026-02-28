/**
 * Secciones fijas del sistema. Aquí se definen las rutas que se pueden
 * asignar a cada rol al crearlo/editarlo.
 */
export const SECTIONS = [
  { path: "/dashboard", label: "Dashboard" },
  { path: "/clients",   label: "Clientes" },
  { path: "/projects",  label: "Proyectos" },
  { path: "/tasks",     label: "Tareas" },
  { path: "/users",     label: "Usuarios" },
] as const;

export type SectionPath = typeof SECTIONS[number]["path"];

export function canAccessPath(permissions: string[], path: string): boolean {
  return permissions.some(
    (allowed) => path === allowed || path.startsWith(allowed + "/")
  );
}
