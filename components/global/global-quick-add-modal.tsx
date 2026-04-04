"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  X, CheckSquare, StickyNote, FolderOpen, Target, Search,
  CheckCircle, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGlobalQuickAdd, type QuickAddTab } from "./global-quick-add-provider";
import type { SearchResult } from "@/app/api/search/route";

// ── Tab config ──────────────────────────────────────────────────────────────

const TABS: { id: QuickAddTab; label: string; Icon: typeof CheckSquare }[] = [
  { id: "task",      label: "Tarea",    Icon: CheckSquare },
  { id: "note",      label: "Nota",     Icon: StickyNote  },
  { id: "project",   label: "Proyecto", Icon: FolderOpen  },
  { id: "objective", label: "Objetivo", Icon: Target      },
  { id: "search",    label: "Buscar",   Icon: Search      },
];

// ── Status labels ────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  todo: "Por hacer", in_progress: "En progreso", review: "Revisión", done: "Hecho",
  planning: "Planificación", active: "Activo", paused: "Pausado",
  completed: "Completado", cancelled: "Cancelado", draft: "Borrador",
};

const TYPE_LABELS: Record<string, string> = {
  task: "Tarea", project: "Proyecto", note: "Nota", objective: "Objetivo",
};

const TYPE_ICONS: Record<string, typeof CheckSquare> = {
  task: CheckSquare, project: FolderOpen, note: StickyNote, objective: Target,
};

// ── Component ────────────────────────────────────────────────────────────────

export function GlobalQuickAddModal() {
  const router = useRouter();
  const { isOpen, activeTab, prefill, close, setTab } = useGlobalQuickAdd();

  // Create form state
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [noteContent, setNoteContent] = useState("");
  const [projectStatus, setProjectStatus] = useState("planning");
  const [horizon, setHorizon] = useState("");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  // Refs for autofocus
  const titleRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Reset all form state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTitle("");
      setPriority("medium");
      setNoteContent("");
      setProjectStatus("planning");
      setHorizon("");
      setSearchQuery("");
      setSearchResults([]);
      setSuccess(null);
    }
  }, [isOpen]);

  // Apply prefill when modal opens
  useEffect(() => {
    if (isOpen && prefill) setTitle(prefill);
  }, [isOpen, prefill]);

  // Autofocus correct input when tab changes or modal opens
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      if (activeTab === "search") searchRef.current?.focus();
      else titleRef.current?.focus();
    }, 60);
    return () => clearTimeout(timer);
  }, [isOpen, activeTab]);

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, close]);

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) setSearchResults(await res.json());
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  function showSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => {
      setSuccess(null);
      close();
      router.refresh();
    }, 900);
  }

  async function handleCreate() {
    if (loading) return;
    setLoading(true);
    try {
      if (activeTab === "task") {
        const t = title.trim();
        if (!t) return;
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: t, priority, status: "todo" }),
        });
        if (res.ok) showSuccess(`Tarea "${t}" creada`);

      } else if (activeTab === "note") {
        const t = title.trim();
        if (!t) return;
        const res = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: t, content: noteContent }),
        });
        if (res.ok) showSuccess(`Nota "${t}" creada`);

      } else if (activeTab === "project") {
        const n = title.trim();
        if (!n) return;
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: n, status: projectStatus }),
        });
        if (res.ok) showSuccess(`Proyecto "${n}" creado`);

      } else if (activeTab === "objective") {
        const t = title.trim();
        if (!t) return;
        const res = await fetch("/api/objectives", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: t, status: "active", horizon: horizon || undefined }),
        });
        if (res.ok) showSuccess(`Objetivo "${t}" creado`);
      }
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={close} />

      {/* Modal card */}
      <div className="relative bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-[520px] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-0">
          <span className="text-xs text-slate-400 font-mono">Ctrl+K</span>
          <button onClick={close} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 px-4 pt-3 pb-0 border-b border-slate-100">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-sm rounded-t-lg transition-colors -mb-px border-b-2",
                activeTab === id
                  ? "text-[#1e3a5f] border-[#1e3a5f] font-medium bg-slate-50"
                  : "text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-5">
          {/* ── Success state ── */}
          {success && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-teal-600" />
              </div>
              <p className="text-sm text-slate-700 font-medium text-center">{success}</p>
            </div>
          )}

          {/* ── Search tab ── */}
          {!success && activeTab === "search" && (
            <div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  ref={searchRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar tareas, proyectos, notas, objetivos..."
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
                />
              </div>

              <div className="mt-3 min-h-[120px]">
                {searching && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                  </div>
                )}

                {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-sm">
                    Sin resultados para "{searchQuery}"
                  </div>
                )}

                {!searching && searchQuery.length < 2 && (
                  <p className="text-center py-8 text-slate-400 text-sm">
                    Escribe al menos 2 caracteres para buscar
                  </p>
                )}

                {!searching && searchResults.length > 0 && (
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {searchResults.map((r) => {
                      const Icon = TYPE_ICONS[r.type] ?? Search;
                      return (
                        <a
                          key={`${r.type}-${r.id}`}
                          href={r.url}
                          onClick={close}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 group-hover:bg-slate-200 transition-colors">
                            <Icon className="w-4 h-4 text-slate-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-800 font-medium truncate">{r.title}</p>
                            <p className="text-xs text-slate-400">{TYPE_LABELS[r.type]}</p>
                          </div>
                          {r.status && (
                            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full flex-shrink-0">
                              {STATUS_LABELS[r.status] ?? r.status}
                            </span>
                          )}
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Tarea form ── */}
          {!success && activeTab === "task" && (
            <div className="space-y-3">
              <input
                ref={titleRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="Título de la tarea"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
              />
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
              >
                <option value="low">Prioridad: Baja</option>
                <option value="medium">Prioridad: Media</option>
                <option value="high">Prioridad: Alta</option>
                <option value="urgent">Prioridad: Urgente</option>
              </select>
              <SubmitButton label="Crear tarea" loading={loading} disabled={!title.trim()} onClick={handleCreate} />
            </div>
          )}

          {/* ── Nota form ── */}
          {!success && activeTab === "note" && (
            <div className="space-y-3">
              <input
                ref={titleRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título de la nota"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
              />
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Contenido (opcional)..."
                rows={3}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 resize-none"
              />
              <SubmitButton label="Crear nota" loading={loading} disabled={!title.trim()} onClick={handleCreate} />
            </div>
          )}

          {/* ── Proyecto form ── */}
          {!success && activeTab === "project" && (
            <div className="space-y-3">
              <input
                ref={titleRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="Nombre del proyecto"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
              />
              <select
                value={projectStatus}
                onChange={(e) => setProjectStatus(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
              >
                <option value="planning">Estado: Planificación</option>
                <option value="active">Estado: Activo</option>
                <option value="paused">Estado: Pausado</option>
              </select>
              <SubmitButton label="Crear proyecto" loading={loading} disabled={!title.trim()} onClick={handleCreate} />
            </div>
          )}

          {/* ── Objetivo form ── */}
          {!success && activeTab === "objective" && (
            <div className="space-y-3">
              <input
                ref={titleRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="Título del objetivo"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
              />
              <select
                value={horizon}
                onChange={(e) => setHorizon(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
              >
                <option value="">Horizonte: Sin definir</option>
                <option value="daily">Diario</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensual</option>
                <option value="quarterly">Trimestral</option>
                <option value="yearly">Anual</option>
                <option value="life">De vida</option>
              </select>
              <SubmitButton label="Crear objetivo" loading={loading} disabled={!title.trim()} onClick={handleCreate} />
            </div>
          )}
        </div>

        {/* Footer hint */}
        {!success && (
          <div className="px-5 pb-4 flex items-center justify-between text-xs text-slate-400">
            <span>Esc para cerrar</span>
            <span>Ctrl+K para abrir/cerrar</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Submit button helper ─────────────────────────────────────────────────────

function SubmitButton({
  label,
  loading,
  disabled,
  onClick,
}: {
  label: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full py-2.5 bg-[#1e3a5f] text-white rounded-xl text-sm font-medium hover:bg-[#162d4a] transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {label}
    </button>
  );
}
