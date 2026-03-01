"use client";

import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="w-9 h-9" />;
  }

  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
      title={resolvedTheme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
    >
      {resolvedTheme === "dark" ? (
        <Sun className="w-4 h-4 text-slate-400" />
      ) : (
        <Moon className="w-4 h-4 text-slate-500" />
      )}
    </button>
  );
}
