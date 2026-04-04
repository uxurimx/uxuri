"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { GlobalFAB } from "./global-fab";
import { GlobalQuickAddModal } from "./global-quick-add-modal";

export type QuickAddTab = "task" | "note" | "project" | "objective" | "search";

interface QuickAddContextType {
  isOpen: boolean;
  activeTab: QuickAddTab;
  prefill: string;
  open: (tab?: QuickAddTab, prefill?: string) => void;
  close: () => void;
  setTab: (tab: QuickAddTab) => void;
}

const QuickAddContext = createContext<QuickAddContextType | null>(null);

export function useGlobalQuickAdd() {
  const ctx = useContext(QuickAddContext);
  if (!ctx) throw new Error("useGlobalQuickAdd must be used inside GlobalQuickAddProvider");
  return ctx;
}

const ROUTE_DEFAULTS: [string, QuickAddTab][] = [
  ["/notes", "note"],
  ["/projects", "project"],
  ["/tasks", "task"],
  ["/objectives", "objective"],
];

export function GlobalQuickAddProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<QuickAddTab>("task");
  const [prefill, setPrefill] = useState("");

  function defaultTab(): QuickAddTab {
    for (const [route, tab] of ROUTE_DEFAULTS) {
      if (pathname.startsWith(route)) return tab;
    }
    return "task";
  }

  const open = useCallback(
    (tab?: QuickAddTab, text?: string) => {
      setActiveTab(tab ?? defaultTab());
      setPrefill(text ?? "");
      setIsOpen(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pathname]
  );

  const close = useCallback(() => {
    setIsOpen(false);
    setPrefill("");
  }, []);

  // Ctrl/Cmd+K shortcut
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) close();
        else open();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, open, close]);

  return (
    <QuickAddContext.Provider
      value={{ isOpen, activeTab, prefill, open, close, setTab: setActiveTab }}
    >
      {children}
      <GlobalFAB />
      <GlobalQuickAddModal />
    </QuickAddContext.Provider>
  );
}
