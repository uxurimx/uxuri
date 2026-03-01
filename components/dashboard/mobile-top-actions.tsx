"use client";

import { useState, useRef, useEffect } from "react";
import { MoreVertical, Sun, Moon, Monitor, Settings } from "lucide-react";
import { useTheme } from "next-themes";
import { UserButton } from "@clerk/nextjs";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { PushSetup } from "@/components/notifications/push-setup";
import Link from "next/link";

export function MobileTopActions() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const themes = [
    { value: "light", label: "Claro", icon: Sun },
    { value: "dark",  label: "Oscuro", icon: Moon },
    { value: "system", label: "Sistema", icon: Monitor },
  ] as const;

  return (
    <div ref={ref} className="fixed top-3 right-4 z-50 md:hidden flex items-center gap-2">
      <NotificationBell />

      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-9 h-9 rounded-lg flex items-center justify-center bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-sm backdrop-blur-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          title="Más opciones"
        >
          <MoreVertical className="w-4 h-4 text-slate-500 dark:text-slate-400" />
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
            {/* Theme section */}
            <div className="px-3 pt-3 pb-2">
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">Tema</p>
              <div className="flex gap-1">
                {themes.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-[11px] font-medium transition-colors ${
                      (mounted ? theme : "system") === value
                        ? "bg-[#1e3a5f] text-white"
                        : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-700" />

            {/* Profile section */}
            <div className="px-3 py-3 flex items-center gap-3">
              <UserButton afterSignOutUrl="/" />
              <span className="text-sm text-slate-600 dark:text-slate-400">Perfil y cuenta</span>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-700" />

            {/* Push notifications */}
            <div className="px-3 py-3">
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">Notificaciones push</p>
              <PushSetup />
            </div>

            <div className="border-t border-slate-100 dark:border-slate-700" />

            {/* Settings link */}
            <Link
              href="/settings"
              className="flex items-center gap-3 px-3 py-3 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
              onClick={() => setOpen(false)}
            >
              <Settings className="w-4 h-4" />
              Configuración
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
