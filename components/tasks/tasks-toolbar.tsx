"use client";

import { Search, LayoutList, LayoutGrid, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const priorities = [
  { value: "all",    label: "Todas" },
  { value: "urgent", label: "Urgente" },
  { value: "high",   label: "Alta" },
  { value: "medium", label: "Media" },
  { value: "low",    label: "Baja" },
];

interface TasksToolbarProps {
  search: string;
  onSearchChange: (v: string) => void;
  priorityFilter: string;
  onPriorityChange: (v: string) => void;
  view: "kanban" | "list";
  onViewChange: (v: "kanban" | "list") => void;
  onNewTask?: () => void;
}

export function TasksToolbar({
  search, onSearchChange,
  priorityFilter, onPriorityChange,
  view, onViewChange,
  onNewTask,
}: TasksToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      {/* Search */}
      <div className="relative flex-1 min-w-48">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar tareas..."
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 bg-white"
        />
      </div>

      {/* Priority filter */}
      <div className="flex gap-1">
        {priorities.map((p) => (
          <button
            key={p.value}
            onClick={() => onPriorityChange(p.value)}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
              priorityFilter === p.value
                ? "bg-[#1e3a5f] text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

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

      {/* Nueva tarea (solo en proyectos) */}
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
  );
}
