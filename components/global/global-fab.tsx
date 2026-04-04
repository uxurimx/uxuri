"use client";

import { Plus, X } from "lucide-react";
import { useGlobalQuickAdd } from "./global-quick-add-provider";
import { cn } from "@/lib/utils";

export function GlobalFAB() {
  const { isOpen, open, close } = useGlobalQuickAdd();

  return (
    <button
      onClick={isOpen ? close : () => open()}
      aria-label={isOpen ? "Cerrar acceso rápido" : "Acceso rápido (Ctrl+K)"}
      className={cn(
        // Mobile: above bottom nav (which is ~64px tall, pb-20)
        "fixed bottom-20 right-4 md:bottom-6 md:right-6",
        "z-[130] w-14 h-14 rounded-full shadow-xl",
        "flex items-center justify-center",
        "transition-all duration-200",
        isOpen
          ? "bg-slate-700 hover:bg-slate-800 rotate-45"
          : "bg-[#1e3a5f] hover:bg-[#162d4a]"
      )}
    >
      {isOpen ? (
        <X className="w-6 h-6 text-white" />
      ) : (
        <Plus className="w-6 h-6 text-white" />
      )}
    </button>
  );
}
