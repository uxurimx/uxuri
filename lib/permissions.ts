export type SectionGroup = "core" | "personal" | "trabajo" | "negocio" | "sistema";

export type Section = {
  path: string;
  label: string;
  group: SectionGroup;
  autoFrom?: string; // si está auto-derivado de otro permiso
};

export const SECTIONS: Section[] = [
  // Core
  { path: "/dashboard", label: "Dashboard",      group: "core" },

  // Personal — mayoría auto-derivadas de /tasks
  { path: "/today",    label: "Hoy",      group: "personal", autoFrom: "/tasks" },
  { path: "/habits",   label: "Hábitos",  group: "personal", autoFrom: "/tasks" },
  { path: "/journal",  label: "Diario",   group: "personal", autoFrom: "/tasks" },
  { path: "/notes",    label: "Notas",    group: "personal", autoFrom: "/tasks" },
  { path: "/schedule", label: "Agenda",   group: "personal", autoFrom: "/tasks" },
  { path: "/review",   label: "Revisión", group: "personal", autoFrom: "/tasks" },

  // Trabajo
  { path: "/tasks",      label: "Tareas",        group: "trabajo" },
  { path: "/projects",   label: "Proyectos",     group: "trabajo" },
  { path: "/objectives", label: "Objetivos",     group: "trabajo", autoFrom: "/projects" },
  { path: "/planning",   label: "Planificación", group: "trabajo", autoFrom: "/projects" },
  { path: "/agents",     label: "Agentes",       group: "trabajo", autoFrom: "/tasks" },

  // Negocio
  { path: "/clients",           label: "Clientes",    group: "negocio" },
  { path: "/clients/pipeline",  label: "Pipeline CRM",group: "negocio", autoFrom: "/clients" },
  { path: "/negocios",          label: "Negocios",    group: "negocio", autoFrom: "/projects" },
  { path: "/finanzas",          label: "Finanzas",    group: "negocio", autoFrom: "/projects" },
  { path: "/comidas",           label: "Comidas",     group: "negocio", autoFrom: "/projects" },
  { path: "/marketing",         label: "Marketing",   group: "negocio", autoFrom: "/clients" },

  // Sistema
  { path: "/chat",  label: "Chat",     group: "sistema" },
  { path: "/users", label: "Usuarios", group: "sistema" },
];

export const SECTION_GROUP_LABELS: Record<SectionGroup, string> = {
  core:     "General",
  personal: "Personal",
  trabajo:  "Trabajo",
  negocio:  "Negocio",
  sistema:  "Sistema",
};

export type SectionPath = (typeof SECTIONS)[number]["path"];

export function canAccessPath(permissions: string[], path: string): boolean {
  return permissions.some(
    (allowed) => path === allowed || path.startsWith(allowed + "/")
  );
}

/** Permisos mínimos recomendados por rol para el seed inicial */
export const DEFAULT_ROLE_SEEDS = [
  {
    name: "admin",
    label: "Administrador",
    permissions: ["/dashboard", "/tasks", "/projects", "/clients", "/chat", "/users"],
    isDefault: false,
  },
  {
    name: "manager",
    label: "Manager",
    permissions: ["/dashboard", "/tasks", "/projects", "/clients", "/chat"],
    isDefault: false,
  },
  {
    name: "client",
    label: "Cliente",
    permissions: ["/dashboard", "/tasks", "/projects"],
    isDefault: true,
  },
] as const;
