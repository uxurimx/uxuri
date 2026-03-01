"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Users, Briefcase, CheckSquare, UserCog, MessageSquare, Bot } from "lucide-react";
import { useChatUnread } from "@/hooks/use-chat-unread";

const navItems = [
  { href: "/dashboard", label: "Home",      icon: LayoutDashboard },
  { href: "/clients",   label: "Clientes",  icon: Users },
  { href: "/projects",  label: "Proyectos", icon: Briefcase },
  { href: "/tasks",     label: "Tareas",    icon: CheckSquare },
  { href: "/agents",    label: "Agentes",   icon: Bot },
  { href: "/chat",      label: "Chat",      icon: MessageSquare },
  { href: "/users",     label: "Usuarios",  icon: UserCog },
];

export function MobileNav({ permissions, currentUserId }: { permissions: string[]; currentUserId: string }) {
  const pathname = usePathname();
  const hasUnread = useChatUnread(currentUserId);
  const visibleItems = navItems.filter((item) => permissions.includes(item.href));

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-[var(--skin-header-bg)] border-t border-[var(--skin-border)] z-40">
      <div className="flex items-center justify-around py-2">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const showDot = item.href === "/chat" && hasUnread && !isActive;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors",
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
