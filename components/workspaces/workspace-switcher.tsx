"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ChevronDown, Plus, Settings as SettingsIcon, Loader2, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

type WorkspaceItem = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  type: "personal" | "business";
  isOwner: boolean;
};

type ProfileItem = {
  id: string;
  name: string;
  label: string;
  icon: string | null;
  color: string | null;
  isDefault: boolean;
};

type ContextResponse = {
  activeWorkspace: { id: string; name: string; icon: string | null; color: string | null } | null;
  activeProfile: { id: string; label: string; icon: string | null; color: string | null } | null;
  isOwner: boolean;
  isGlobalMode: boolean;
  workspaces: WorkspaceItem[];
  availableProfiles: ProfileItem[];
};

export function WorkspaceSwitcher() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [data, setData] = useState<ContextResponse | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/workspaces/context", { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  async function switchWorkspace(workspaceId: string) {
    const isCurrentlyGlobal = data?.isGlobalMode && workspaceId === "global";
    const isCurrentlyNormal = !data?.isGlobalMode && data?.activeWorkspace?.id === workspaceId;
    if (switching || isCurrentlyGlobal || isCurrentlyNormal) return;
    setSwitching(true);
    try {
      const res = await fetch("/api/workspaces/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      if (res.ok) {
        setOpen(false);
        await load();
        router.refresh();
      }
    } finally {
      setSwitching(false);
    }
  }

  async function switchProfile(profileId: string) {
    if (switching || data?.activeProfile?.id === profileId) return;
    setSwitching(true);
    try {
      const res = await fetch("/api/profiles/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      });
      if (res.ok) {
        setOpen(false);
        await load();
        router.refresh();
      }
    } finally {
      setSwitching(false);
    }
  }

  if (loading) {
    return (
      <div className="h-9 w-44 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 animate-pulse" />
    );
  }

  if (!data || (!data.activeWorkspace && !data.isGlobalMode)) {
    return (
      <Link
        href="/workspaces"
        className="flex items-center gap-2 px-3 h-9 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
      >
        <Plus className="w-4 h-4" />
        Crear workspace
      </Link>
    );
  }

  const ws = data.activeWorkspace;
  const profile = data.activeProfile;
  const isGlobal = data.isGlobalMode;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 h-9 px-2.5 rounded-lg border text-sm transition",
          isGlobal
            ? "border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
            : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800",
          "text-slate-700 dark:text-slate-200",
          open && !isGlobal && "bg-slate-50 dark:bg-slate-800"
        )}
        title={isGlobal ? "Vista global — todos los datos" : `${ws?.name}${profile ? ` · ${profile.label}` : ""}`}
      >
        {switching ? (
          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
        ) : isGlobal ? (
          <Globe className="w-5 h-5 text-indigo-500 flex-shrink-0" />
        ) : (
          <span
            className="flex items-center justify-center w-6 h-6 rounded-md text-sm flex-shrink-0"
            style={{ backgroundColor: (ws?.color ?? "#1e3a5f") + "22" }}
          >
            {ws?.icon ?? "🏢"}
          </span>
        )}
        <span className="hidden md:flex flex-col items-start leading-tight max-w-[140px]">
          {isGlobal ? (
            <span className="font-semibold truncate w-full text-indigo-600 dark:text-indigo-400">Vista global</span>
          ) : (
            <>
              <span className="font-semibold truncate w-full text-slate-800 dark:text-slate-100">{ws?.name}</span>
              {profile && (
                <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate w-full">
                  {profile.icon ?? "👤"} {profile.label}
                </span>
              )}
            </>
          )}
        </span>
        <ChevronDown className={cn("w-3.5 h-3.5 opacity-50 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-72 z-50 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
          {/* Global mode option */}
          <button
            type="button"
            onClick={() => switchWorkspace("global")}
            disabled={switching}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 text-sm transition text-left border-b border-slate-100 dark:border-slate-800 disabled:opacity-50",
              isGlobal
                ? "bg-indigo-50 dark:bg-indigo-950/40"
                : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
            )}
          >
            <span className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 text-base bg-indigo-100 dark:bg-indigo-900/50">
              🌐
            </span>
            <span className="flex-1 min-w-0">
              <div className={cn("font-semibold truncate", isGlobal ? "text-indigo-600 dark:text-indigo-400" : "text-slate-800 dark:text-slate-100")}>Vista global</div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500">Ver todos los datos sin filtro</div>
            </span>
            {isGlobal && <Check className="w-4 h-4 text-indigo-500 flex-shrink-0" />}
          </button>

          {/* Workspaces */}
          <div className="px-3 pt-3 pb-1 text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Workspaces
          </div>
          <div className="max-h-52 overflow-y-auto">
            {data.workspaces.map((w) => {
              const isActive = !isGlobal && w.id === ws?.id;
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => switchWorkspace(w.id)}
                  disabled={switching}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-sm transition text-left disabled:opacity-50",
                    isActive
                      ? "bg-slate-50 dark:bg-slate-800"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  )}
                >
                  <span
                    className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 text-base"
                    style={{ backgroundColor: (w.color ?? "#1e3a5f") + "22" }}
                  >
                    {w.icon ?? "🏢"}
                  </span>
                  <span className="flex-1 min-w-0">
                    <div className="font-semibold truncate text-slate-800 dark:text-slate-100">{w.name}</div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500">
                      {w.type === "personal" ? "Personal" : "Empresa"}
                      {w.isOwner && " · Owner"}
                    </div>
                  </span>
                  {isActive && <Check className="w-4 h-4 text-blue-500 flex-shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Profiles */}
          {!isGlobal && data.availableProfiles.length > 1 && (
            <>
              <div className="px-3 pt-3 pb-1 text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800">
                Perfil en {ws?.name}
              </div>
              <div className="max-h-44 overflow-y-auto">
                {data.availableProfiles.map((p) => {
                  const isActive = p.id === profile?.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => switchProfile(p.id)}
                      disabled={switching}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 text-sm transition text-left disabled:opacity-50",
                        isActive
                          ? "bg-slate-50 dark:bg-slate-800"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      )}
                    >
                      <span className="w-8 h-8 flex items-center justify-center text-base flex-shrink-0 rounded-lg bg-slate-100 dark:bg-slate-800">
                        {p.icon ?? "👤"}
                      </span>
                      <span className="flex-1 min-w-0">
                        <div className="font-semibold truncate text-slate-800 dark:text-slate-100">{p.label}</div>
                        {p.isDefault && (
                          <div className="text-[11px] text-slate-400 dark:text-slate-500">Por defecto</div>
                        )}
                      </span>
                      {isActive && <Check className="w-4 h-4 text-blue-500 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Footer */}
          <div className="border-t border-slate-100 dark:border-slate-800 flex">
            <Link
              href="/workspaces"
              onClick={() => setOpen(false)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              <SettingsIcon className="w-3.5 h-3.5" />
              Gestionar
            </Link>
            <Link
              href="/workspaces?new=1"
              onClick={() => setOpen(false)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition border-l border-slate-100 dark:border-slate-800"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuevo
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
