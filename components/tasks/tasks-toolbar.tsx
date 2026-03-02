"use client";

import { useState, useRef, useEffect } from "react";
import {
  Search, LayoutList, LayoutGrid, Plus, User, Eye, EyeOff,
  Filter, X, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Filter types (shared with kanban-board) ───────────────────────────────────

export type TaskFilters = {
  search: string;
  priority: "all" | "low" | "medium" | "high" | "urgent";
  hideDone: boolean;
  assignee: "all" | "me" | "unassigned";
  projectId: string;
  dueDateFilter: "all" | "overdue" | "this-week" | "no-date";
};

export const DEFAULT_TASK_FILTERS: TaskFilters = {
  search: "",
  priority: "all",
  hideDone: true,        // ← done tasks hidden by default
  assignee: "all",
  projectId: "",
  dueDateFilter: "all",
};

// ── Constants ─────────────────────────────────────────────────────────────────

const PRIORITIES = [
  { value: "all",    label: "Todas" },
  { value: "urgent", label: "Urgente" },
  { value: "high",   label: "Alta" },
  { value: "medium", label: "Media" },
  { value: "low",    label: "Baja" },
];

const DUE_OPTIONS = [
  { value: "all",       label: "Todas" },
  { value: "overdue",   label: "Vencidas" },
  { value: "this-week", label: "Esta semana" },
  { value: "no-date",   label: "Sin fecha" },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface TasksToolbarProps {
  filters: TaskFilters;
  onFiltersChange: (patch: Partial<TaskFilters>) => void;
  onResetFilters: () => void;
  view: "kanban" | "list";
  onViewChange: (v: "kanban" | "list") => void;
  onNewTask?: () => void;
  projects?: { id: string; name: string }[];
  currentUserId?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TasksToolbar({
  filters,
  onFiltersChange,
  onResetFilters,
  view,
  onViewChange,
  onNewTask,
  projects = [],
  currentUserId,
}: TasksToolbarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close advanced panel on outside click
  useEffect(() => {
    if (!showAdvanced) return;
    function handle(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowAdvanced(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [showAdvanced]);

  // Count filters inside the advanced panel
  const advancedCount = [
    filters.assignee !== "all",
    filters.projectId !== "",
    filters.dueDateFilter !== "all",
  ].filter(Boolean).length;

  // Active filter chips (for row 2)
  type Chip = { label: string; onRemove: () => void };
  const chips: Chip[] = [];

  if (filters.assignee === "unassigned")
    chips.push({ label: "Sin asignar", onRemove: () => onFiltersChange({ assignee: "all" }) });

  if (filters.projectId) {
    const name = projects.find((p) => p.id === filters.projectId)?.name ?? "Proyecto";
    chips.push({ label: name, onRemove: () => onFiltersChange({ projectId: "" }) });
  }

  if (filters.dueDateFilter !== "all") {
    const label = DUE_OPTIONS.find((o) => o.value === filters.dueDateFilter)?.label ?? "";
    chips.push({ label, onRemove: () => onFiltersChange({ dueDateFilter: "all" }) });
  }

  if (!filters.hideDone)
    chips.push({ label: "Mostrando completadas", onRemove: () => onFiltersChange({ hideDone: true }) });

  const hasAnyActive =
    filters.priority !== "all" ||
    filters.assignee !== "all" ||
    filters.projectId !== "" ||
    filters.dueDateFilter !== "all" ||
    !filters.hideDone;

  return (
    <div className="space-y-2 mb-4">
      {/* ── Row 1 ── */}
      <div className="flex flex-wrap gap-2 items-center">

        {/* Search */}
        <div className="relative flex-1 min-w-44">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            value={filters.search}
            onChange={(e) => onFiltersChange({ search: e.target.value })}
            placeholder="Buscar tareas..."
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="w-full pl-9 pr-8 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 bg-white"
          />
          {filters.search && (
            <button
              onClick={() => onFiltersChange({ search: "" })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Quick: Mis tareas */}
        {currentUserId && (
          <button
            onClick={() => onFiltersChange({ assignee: filters.assignee === "me" ? "all" : "me" })}
            title="Mostrar solo tareas asignadas a mí"
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap",
              filters.assignee === "me"
                ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            )}
          >
            <User className="w-3 h-3" />
            Mis tareas
          </button>
        )}

        {/* Quick: Completadas toggle */}
        <button
          onClick={() => onFiltersChange({ hideDone: !filters.hideDone })}
          title={filters.hideDone ? "Mostrar tareas completadas" : "Ocultar tareas completadas"}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap",
            !filters.hideDone
              ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          )}
        >
          {filters.hideDone
            ? <EyeOff className="w-3 h-3" />
            : <Eye className="w-3 h-3" />
          }
          Completadas
        </button>

        {/* Priority pills */}
        <div className="flex gap-1">
          {PRIORITIES.map((p) => (
            <button
              key={p.value}
              onClick={() => onFiltersChange({ priority: p.value as TaskFilters["priority"] })}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
                filters.priority === p.value
                  ? "bg-[#1e3a5f] text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Advanced filters */}
        <div className="relative" ref={panelRef}>
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap",
              advancedCount > 0 || showAdvanced
                ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            )}
          >
            <Filter className="w-3 h-3" />
            Más filtros
            {advancedCount > 0 && (
              <span className="bg-white/30 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {advancedCount}
              </span>
            )}
            <ChevronDown className={cn("w-3 h-3 transition-transform", showAdvanced && "rotate-180")} />
          </button>

          {showAdvanced && (
            <div className="absolute top-full right-0 mt-1.5 z-30 bg-white border border-slate-200 rounded-xl shadow-xl p-4 w-64 space-y-4">

              {/* Asignado */}
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-2">Asignado a</p>
                <div className="flex gap-1">
                  {[
                    { value: "all",        label: "Todos" },
                    { value: "me",         label: "Yo" },
                    { value: "unassigned", label: "Sin asignar" },
                  ].map((o) => (
                    <button
                      key={o.value}
                      onClick={() => onFiltersChange({ assignee: o.value as TaskFilters["assignee"] })}
                      className={cn(
                        "flex-1 py-1 rounded-lg text-xs font-medium border transition-colors",
                        filters.assignee === o.value
                          ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Proyecto */}
              {projects.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2">Proyecto</p>
                  <select
                    value={filters.projectId}
                    onChange={(e) => onFiltersChange({ projectId: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 bg-white"
                  >
                    <option value="">Todos los proyectos</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Fecha límite */}
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-2">Fecha límite</p>
                <div className="grid grid-cols-2 gap-1">
                  {DUE_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      onClick={() => onFiltersChange({ dueDateFilter: o.value as TaskFilters["dueDateFilter"] })}
                      className={cn(
                        "py-1 rounded-lg text-xs font-medium border transition-colors",
                        filters.dueDateFilter === o.value
                          ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Limpiar */}
              <button
                onClick={() => { onResetFilters(); setShowAdvanced(false); }}
                className="w-full py-1.5 text-xs text-slate-400 hover:text-red-500 transition-colors border-t border-slate-100 pt-3"
              >
                Limpiar todos los filtros
              </button>
            </div>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1 hidden sm:block" />

        {/* View toggle */}
        <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden">
          <button
            onClick={() => onViewChange("kanban")}
            className={cn("px-2.5 py-1.5 transition-colors", view === "kanban" ? "bg-[#1e3a5f] text-white" : "text-slate-400 hover:bg-slate-50")}
            title="Vista kanban"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewChange("list")}
            className={cn("px-2.5 py-1.5 transition-colors", view === "list" ? "bg-[#1e3a5f] text-white" : "text-slate-400 hover:bg-slate-50")}
            title="Vista lista"
          >
            <LayoutList className="w-4 h-4" />
          </button>
        </div>

        {/* Nueva tarea */}
        {onNewTask && (
          <button
            onClick={onNewTask}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#162d4a] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nueva tarea
          </button>
        )}
      </div>

      {/* ── Row 2: Active filter chips ── */}
      {(chips.length > 0 || hasAnyActive) && (
        <div className="flex gap-1.5 flex-wrap items-center">
          <span className="text-[11px] text-slate-400 font-medium">Activos:</span>

          {/* Priority chip */}
          {filters.priority !== "all" && (
            <FilterChip
              label={PRIORITIES.find((p) => p.value === filters.priority)?.label ?? ""}
              onRemove={() => onFiltersChange({ priority: "all" })}
            />
          )}

          {/* Mis tareas chip */}
          {filters.assignee === "me" && (
            <FilterChip label="Mis tareas" onRemove={() => onFiltersChange({ assignee: "all" })} />
          )}

          {/* Other chips */}
          {chips.map((chip, i) => (
            <FilterChip key={i} label={chip.label} onRemove={chip.onRemove} />
          ))}

          {hasAnyActive && (
            <button
              onClick={onResetFilters}
              className="text-[11px] text-slate-400 hover:text-red-500 transition-colors ml-1 underline underline-offset-2"
            >
              Limpiar todo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1 pl-2 pr-1 py-0.5 bg-[#1e3a5f]/8 text-[#1e3a5f] text-[11px] rounded-full font-medium border border-[#1e3a5f]/15">
      {label}
      <button
        onClick={onRemove}
        className="p-0.5 rounded-full hover:bg-[#1e3a5f]/15 transition-colors"
      >
        <X className="w-2.5 h-2.5" />
      </button>
    </span>
  );
}
