"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Users, Briefcase, CheckSquare, UserCog, MessageSquare } from "lucide-react";
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

  return (
    <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-slate-300 flex-shrink-0">
      <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800">
        <div className="w-8 h-8 rounded-lg bg-[#1e3a5f] flex items-center justify-center">
          <span className="text-white font-bold text-sm">U</span>
        </div>
        <span className="text-white font-bold text-lg">Uxuri</span>
      </div>

      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const showDot = item.href === "/chat" && hasUnread && !isActive;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                isActive ? "bg-[#1e3a5f] text-white" : "hover:bg-slate-800 hover:text-white"
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

      <div className="p-4 border-t border-slate-800">
        <p className="text-xs text-slate-600 text-center">Uxuri v0.1.0</p>
      </div>
    </aside>
  );
}
