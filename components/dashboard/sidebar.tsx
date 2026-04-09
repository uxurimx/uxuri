"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Users, Briefcase, CheckSquare, UserCog,
  MessageSquare, Settings, Bot, Target, Zap, Sun, Repeat2,
  BookOpen, StickyNote, CalendarDays, RefreshCw, Megaphone,
  Building2, Wallet, UtensilsCrossed, ChevronDown,
} from "lucide-react";
import { useChatUnread } from "@/hooks/use-chat-unread";

type NavItem = { href: string; label: string; icon: React.ElementType };
type NavGroup = { id: string; label: string | null; collapsable: boolean; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    id: "pinned",
    label: null,
    collapsable: false,
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
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
      { href: "/planning",   label: "Planificación", icon: Zap },
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
      { href: "/marketing", label: "Marketing", icon: Megaphone },
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

const STORAGE_KEY = "uxuri-sidebar-collapsed";

export function Sidebar({ permissions, currentUserId }: { permissions: string[]; currentUserId: string }) {
  const pathname = usePathname();
  const hasUnread = useChatUnread(currentUserId);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const isSettingsActive = pathname === "/settings" || pathname.startsWith("/settings/");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setCollapsed(new Set(JSON.parse(stored)));
    } catch {}
  }, []);

  // Auto-expand the group that contains the active route
  useEffect(() => {
    for (const group of NAV_GROUPS) {
      if (!group.collapsable) continue;
      const hasActive = group.items.some(
        (item) => pathname === item.href || pathname.startsWith(item.href + "/")
      );
      if (hasActive) {
        setCollapsed((prev) => {
          if (!prev.has(group.id)) return prev;
          const next = new Set(prev);
          next.delete(group.id);
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])); } catch {}
          return next;
        });
      }
    }
  }, [pathname]);

  function toggleGroup(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  return (
    <aside className="hidden md:flex flex-col w-64 bg-[var(--skin-sidebar-bg)] text-[var(--skin-sidebar-text)] flex-shrink-0">
      <div className="h-16 flex items-center gap-3 px-6 border-b border-[var(--skin-sidebar-border)]">
        <div className="w-8 h-8 rounded-lg bg-[var(--skin-active-bg)] flex items-center justify-center">
          <span className="text-[var(--skin-active-text)] font-bold text-sm">U</span>
        </div>
        <span className="text-[var(--skin-header-text-strong,#fff)] font-bold text-lg">Uxuri</span>
      </div>

      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        {NAV_GROUPS.map((group, gi) => {
          const visibleItems = group.items.filter((item) => permissions.includes(item.href));
          if (visibleItems.length === 0) return null;
          const isCollapsed = collapsed.has(group.id);

          return (
            <div
              key={group.id}
              className={cn(
                "mb-1",
                gi > 0 && !group.label && "mt-2 pt-2 border-t border-[var(--skin-sidebar-border)]"
              )}
            >
              {group.label && (
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center justify-between px-3 py-1.5 mb-0.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider text-[var(--skin-sidebar-text-muted,#94a3b8)] hover:text-[var(--skin-active-text)] transition-colors"
                >
                  {group.label}
                  <ChevronDown
                    className={cn(
                      "w-3 h-3 transition-transform duration-200",
                      isCollapsed && "-rotate-90"
                    )}
                  />
                </button>
              )}

              {!isCollapsed && (
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                    const showDot = item.href === "/chat" && hasUnread && !isActive;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        data-active={isActive ? "true" : undefined}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                          isActive
                            ? "bg-[var(--skin-active-bg)] text-[var(--skin-active-text)]"
                            : "hover:bg-[var(--skin-sidebar-hover)] hover:text-[var(--skin-active-text)]"
                        )}
                      >
                        <div className="relative">
                          <item.icon className="w-4 h-4 flex-shrink-0" />
                          {showDot && (
                            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400" />
                          )}
                        </div>
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="px-3 pb-2">
        <Link
          href="/settings"
          data-active={isSettingsActive ? "true" : undefined}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm mb-1 transition-colors",
            isSettingsActive
              ? "bg-[var(--skin-active-bg)] text-[var(--skin-active-text)]"
              : "text-[var(--skin-sidebar-text)] hover:bg-[var(--skin-sidebar-hover)] hover:text-[var(--skin-active-text)]"
          )}
        >
          <Settings className="w-4 h-4" />
          Configuración
        </Link>
      </div>

      <div className="px-4 pb-4 border-t border-[var(--skin-sidebar-border)] pt-3">
        <p className="text-xs text-[var(--skin-sidebar-text-muted)] text-center">Uxuri v0.1.0</p>
      </div>
    </aside>
  );
}
