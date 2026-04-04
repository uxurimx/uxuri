"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Users, Briefcase, CheckSquare, UserCog, MessageSquare, Bot, Target, Sun, Repeat2, BookOpen, StickyNote, CalendarDays, RefreshCw, Zap, Megaphone } from "lucide-react";
import { useChatUnread } from "@/hooks/use-chat-unread";
import { applyNavLayout, type NavLayoutItem } from "@/lib/nav-layout";

const navItems = [
  { href: "/dashboard",  label: "Home",      icon: LayoutDashboard },
  { href: "/today",      label: "Hoy",       icon: Sun },
  { href: "/habits",     label: "Hábitos",   icon: Repeat2 },
  { href: "/journal",    label: "Diario",    icon: BookOpen },
  { href: "/notes",      label: "Notas",     icon: StickyNote },
  { href: "/schedule",   label: "Agenda",    icon: CalendarDays },
  { href: "/review",     label: "Revisión",  icon: RefreshCw },
  { href: "/clients",    label: "Clientes",  icon: Users },
  { href: "/projects",   label: "Proyectos", icon: Briefcase },
  { href: "/objectives", label: "Objetivos", icon: Target },
  { href: "/planning",   label: "Planif.",   icon: Zap },
  { href: "/tasks",      label: "Tareas",    icon: CheckSquare },
  { href: "/agents",     label: "Agentes",   icon: Bot },
  { href: "/marketing",  label: "Marketing", icon: Megaphone },
  { href: "/chat",       label: "Chat",      icon: MessageSquare },
  { href: "/users",      label: "Usuarios",  icon: UserCog },
];

export function MobileNav({ permissions, currentUserId, navLayout }: {
  permissions: string[];
  currentUserId: string;
  navLayout?: NavLayoutItem[] | null;
}) {
  const pathname = usePathname();
  const hasUnread = useChatUnread(currentUserId);
  const permitted = navItems.filter((item) => permissions.includes(item.href));
  const visibleItems = applyNavLayout(permitted, navLayout);

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-[var(--skin-header-bg)] border-t border-[var(--skin-border)] z-40">
      <div className="flex items-center py-2 overflow-x-auto scrollbar-none px-2 gap-1">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const showDot = item.href === "/chat" && hasUnread && !isActive;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors shrink-0",
                isActive ? "text-[var(--skin-active-text)]" : "text-[var(--skin-sidebar-text)]"
              )}
            >
              <div className="relative">
                <item.icon className="w-5 h-5" />
                {showDot && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[var(--skin-header-bg)]" />
                )}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
