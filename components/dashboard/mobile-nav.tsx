"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Users, Briefcase, CheckSquare, UserCog, MessageSquare } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Home",      icon: LayoutDashboard },
  { href: "/clients",   label: "Clientes",  icon: Users },
  { href: "/projects",  label: "Proyectos", icon: Briefcase },
  { href: "/tasks",     label: "Tareas",    icon: CheckSquare },
  { href: "/chat",      label: "Chat",      icon: MessageSquare },
  { href: "/users",     label: "Usuarios",  icon: UserCog },
];

export function MobileNav({ permissions }: { permissions: string[] }) {
  const pathname = usePathname();
  const visibleItems = navItems.filter((item) => permissions.includes(item.href));

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 z-40">
      <div className="flex items-center justify-around py-2">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors",
                isActive ? "text-[#1e3a5f]" : "text-slate-400"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
