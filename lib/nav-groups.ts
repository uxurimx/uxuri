import {
  LayoutDashboard, Users, Briefcase, CheckSquare, UserCog,
  MessageSquare, Bot, Target, Zap, Sun, Repeat2,
  BookOpen, StickyNote, CalendarDays, RefreshCw, Megaphone,
  Building2, Wallet, UtensilsCrossed,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  mobileLabel?: string;
  icon: LucideIcon;
};

export type NavGroupDef = {
  id: string;
  label: string | null;
  collapsable: boolean;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroupDef[] = [
  {
    id: "pinned",
    label: null,
    collapsable: false,
    items: [
      { href: "/dashboard", label: "Dashboard", mobileLabel: "Home", icon: LayoutDashboard },
    ],
  },
  {
    id: "personal",
    label: "Personal",
    collapsable: true,
    items: [
      { href: "/today",    label: "Hoy",      icon: Sun },
      { href: "/habits",   label: "Hábitos",  icon: Repeat2 },
      { href: "/journal",  label: "Diario",   icon: BookOpen },
      { href: "/notes",    label: "Notas",    icon: StickyNote },
      { href: "/schedule", label: "Agenda",   icon: CalendarDays },
      { href: "/review",   label: "Revisión", icon: RefreshCw },
    ],
  },
  {
    id: "trabajo",
    label: "Trabajo",
    collapsable: true,
    items: [
      { href: "/projects",   label: "Proyectos",     icon: Briefcase },
      { href: "/tasks",      label: "Tareas",        icon: CheckSquare },
      { href: "/objectives", label: "Objetivos",     icon: Target },
      { href: "/planning",   label: "Planificación", mobileLabel: "Planif.", icon: Zap },
      { href: "/agents",     label: "Agentes",       icon: Bot },
    ],
  },
  {
    id: "negocio",
    label: "Negocio",
    collapsable: true,
    items: [
      { href: "/negocios",  label: "Negocios",  icon: Building2 },
      { href: "/clients",   label: "Clientes",  icon: Users },
      { href: "/finanzas",  label: "Finanzas",  icon: Wallet },
      { href: "/comidas",   label: "Comidas",   icon: UtensilsCrossed },
      { href: "/marketing", label: "Marketing", mobileLabel: "Mkt", icon: Megaphone },
    ],
  },
  {
    id: "sistema",
    label: null,
    collapsable: false,
    items: [
      { href: "/chat",  label: "Chat",     icon: MessageSquare },
      { href: "/users", label: "Usuarios", icon: UserCog },
    ],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
