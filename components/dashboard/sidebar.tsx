"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Users, Briefcase, CheckSquare, UserCog, MessageSquare, Settings } from "lucide-react";
import { useChatUnread } from "@/hooks/use-chat-unread";

const navItems = [
  { href: "/dashboard", label: "Dashboard",  icon: LayoutDashboard },
  { href: "/clients",   label: "Clientes",   icon: Users },
  { href: "/projects",  label: "Proyectos",  icon: Briefcase },
  { href: "/tasks",     label: "Tareas",     icon: CheckSquare },
  { href: "/chat",      label: "Chat",       icon: MessageSquare },
  { href: "/users",     label: "Usuarios",   icon: UserCog },
];

export function Sidebar({ permissions, currentUserId }: { permissions: string[]; currentUserId: string }) {
  const pathname = usePathname();
  const hasUnread = useChatUnread(currentUserId);
  const visibleItems = navItems.filter((item) => permissions.includes(item.href));
  const isSettingsActive = pathname === "/settings" || pathname.startsWith("/settings/");

  return (
    <aside className="hidden md:flex flex-col w-64 bg-[var(--skin-sidebar-bg)] text-[var(--skin-sidebar-text)] flex-shrink-0">
      <div className="h-16 flex items-center gap-3 px-6 border-b border-[var(--skin-sidebar-border)]">
        <div className="w-8 h-8 rounded-lg bg-[var(--skin-active-bg)] flex items-center justify-center">
          <span className="text-[var(--skin-active-text)] font-bold text-sm">U</span>
        </div>
        <span className="text-[var(--skin-header-text-strong,#fff)] font-bold text-lg">Uxuri</span>
      </div>

      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
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
