"use client";

import { useState, useEffect, useMemo } from "react";
import { formatDate, cn } from "@/lib/utils";
import {
  Trash2, Lock, Users, Search, SlidersHorizontal, LayoutGrid, Table2,
  ArrowUpDown, Flag, MoveRight, ChevronUp, ChevronDown, ExternalLink,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { ProjectForModal } from "./project-modal";
import { ProjectModal } from "./project-modal";
import { ProjectMergeModal } from "./project-merge-modal";
import { getCycleInfo } from "@/lib/cycles";

export type ProjectWithCounts = ProjectForModal & {
  taskCount: number;
  doneCount: number;
  createdAt?: Date | string | null;
};

type Client = { id: string; name: string };
type ObjectiveOption = { id: string; title: string };
type SortKey = "name" | "endDate" | "priority" | "tasks" | "createdAt";
type SortDir = "asc" | "desc";

const statusConfig = {
  planning:  { label: "Planeación", className: "bg-slate-100 text-slate-600" },
  active:    { label: "Activo",     className: "bg-emerald-50 text-emerald-700" },
  paused:    { label: "Pausado",    className: "bg-amber-50 text-amber-700" },
  completed: { label: "Completado", className: "bg-blue-50 text-blue-700" },
  cancelled: { label: "Cancelado",  className: "bg-red-50 text-red-700" },
};

const priorityConfig = {
  low:    { label: "Baja",  className: "text-slate-400", order: 0 },
  medium: { label: "Media", className: "text-amber-500", order: 1 },
  high:   { label: "Alta",  className: "text-orange-500", order: 2 },
};

const rangeConfig: Record<string, string> = {
  short: "Corto plazo",
  long:  "Largo plazo",
};

const PRIORITY_ORDER = { low: 0, medium: 1, high: 2 };

function getView(): "grid" | "table" {
  if (typeof window === "undefined") return "grid";
  return (localStorage.getItem("projects-view") as "grid" | "table") ?? "grid";
}

export function ProjectsList({
  projects,
  clients,
  objectives,
  currentUserId,
}: {
  projects: ProjectWithCounts[];
  clients: Client[];
  objectives?: ObjectiveOption[];
  currentUserId?: string;
}) {
  const router = useRouter();

  // Filters & sort
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [view, setView] = useState<"grid" | "table">("grid");
  const [showFilters, setShowFilters] = useState(false);

  // Modals
  const [selectedProject, setSelectedProject] = useState<ProjectWithCounts | null>(null);
  const [mergeSourceId, setMergeSourceId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load view preference
  useEffect(() => {
    setView(getView());
  }, []);

  function toggleView(v: "grid" | "table") {
    setView(v);
    localStorage.setItem("projects-view", v);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const filtered = useMemo(() => {
    let list = [...projects];

    // Status filter
    if (statusFilter !== "all") list = list.filter((p) => p.status === statusFilter);

    // Priority filter
    if (priorityFilter !== "all") list = list.filter((p) => p.priority === priorityFilter);

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description ?? "").toLowerCase().includes(q) ||
          (p.clientName ?? "").toLowerCase().includes(q) ||
          (p.category ?? "").toLowerCase().includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "endDate") {
        const da = a.endDate ? new Date(a.endDate).getTime() : Infinity;
        const db2 = b.endDate ? new Date(b.endDate).getTime() : Infinity;
        cmp = da - db2;
      } else if (sortKey === "priority") {
        cmp = (PRIORITY_ORDER[a.priority] ?? 0) - (PRIORITY_ORDER[b.priority] ?? 0);
      } else if (sortKey === "tasks") {
        cmp = a.taskCount - b.taskCount;
      } else {
        // createdAt
        cmp = new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [projects, statusFilter, priorityFilter, search, sortKey, sortDir]);

  async function handleDelete(e: React.MouseEvent, project: ProjectWithCounts) {
    e.stopPropagation();
    if (!confirm(`¿Eliminar "${project.name}"? Las tareas asociadas quedarán sin proyecto.`)) return;
    setDeletingId(project.id);
    try {
      await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (
      sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
    ) : (
      <ArrowUpDown className="w-3 h-3 opacity-30" />
    );

  // Project list for merge modal (lightweight)
  const projectsForMerge = useMemo(
    () => projects.map((p) => ({ id: p.id, name: p.name, taskCount: p.taskCount })),
    [projects]
  );

  return (
    <div className="space-y-4">
      {/* Controls bar */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar proyectos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 bg-white"
            />
          </div>

          {/* Sort */}
          <select
            value={`${sortKey}-${sortDir}`}
            onChange={(e) => {
              const [k, d] = e.target.value.split("-") as [SortKey, SortDir];
              setSortKey(k); setSortDir(d);
            }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 bg-white"
          >
            <option value="createdAt-desc">Más recientes</option>
            <option value="createdAt-asc">Más antiguos</option>
            <option value="name-asc">Nombre A→Z</option>
            <option value="name-desc">Nombre Z→A</option>
            <option value="endDate-asc">Fecha fin ↑</option>
            <option value="priority-desc">Prioridad ↓</option>
            <option value="tasks-desc">Más tareas</option>
          </select>

          {/* Filters toggle */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm transition-colors",
              showFilters
                ? "border-[#1e3a5f] text-[#1e3a5f] bg-[#1e3a5f]/5"
                : "border-slate-200 text-slate-600 bg-white hover:bg-slate-50"
            )}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filtros
          </button>

          {/* View toggle */}
          <div className="flex border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleView("grid")}
              className={cn(
                "px-3 py-2 transition-colors",
                view === "grid" ? "bg-[#1e3a5f] text-white" : "bg-white text-slate-500 hover:bg-slate-50"
              )}
              title="Vista tarjetas"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => toggleView("table")}
              className={cn(
                "px-3 py-2 transition-colors border-l border-slate-200",
                view === "table" ? "bg-[#1e3a5f] text-white" : "bg-white text-slate-500 hover:bg-slate-50"
              )}
              title="Vista tabla"
            >
              <Table2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
            {/* Status */}
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-xs text-slate-500 mr-1">Estado:</span>
              {[
                { value: "all", label: "Todos" },
                { value: "active", label: "Activos" },
                { value: "planning", label: "Planeación" },
                { value: "paused", label: "Pausados" },
                { value: "completed", label: "Completados" },
                { value: "cancelled", label: "Cancelados" },
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                    statusFilter === tab.value
                      ? "bg-[#1e3a5f] text-white"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="w-px bg-slate-200 self-stretch mx-1" />

            {/* Priority */}
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-xs text-slate-500 mr-1">Prioridad:</span>
              {[
                { value: "all", label: "Todas" },
                { value: "high", label: "Alta" },
                { value: "medium", label: "Media" },
                { value: "low", label: "Baja" },
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setPriorityFilter(tab.value)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                    priorityFilter === tab.value
                      ? "bg-[#1e3a5f] text-white"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Results count */}
      {(search || statusFilter !== "all" || priorityFilter !== "all") && (
        <p className="text-xs text-slate-400">
          {filtered.length} {filtered.length === 1 ? "proyecto" : "proyectos"} encontrados
          {search && <> para «<strong>{search}</strong>»</>}
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-200">
          No hay proyectos con estos filtros
        </div>
      ) : view === "grid" ? (
        /* ── GRID VIEW ── */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((project) => {
            const status = statusConfig[project.status];
            const priority = priorityConfig[project.priority];
            const cycle = getCycleInfo(project.cycleMinutes, project.lastCycleAt, project.nextCycleAt);
            const pct = project.taskCount > 0 ? Math.round((project.doneCount / project.taskCount) * 100) : 0;

            return (
              <div
                key={project.id}
                onClick={() => setSelectedProject(project)}
                className="group relative bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer"
              >
                <div className="p-5">
                  {/* Actions overlay */}
                  {!project.isShared && (
                    <div className="absolute top-3 right-3 hidden group-hover:flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); setMergeSourceId(project.id); }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Mover tareas / Unificar"
                      >
                        <MoveRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, project)}
                        disabled={deletingId === project.id}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-start justify-between mb-3 pr-16">
                    <h3 className="font-semibold text-slate-900 line-clamp-1 flex items-center gap-1.5">
                      {project.privacy === "private" && <Lock className="w-3 h-3 text-slate-400 flex-shrink-0" />}
                      {project.name}
                    </h3>
                    <span className={cn("ml-2 text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap flex-shrink-0", status.className)}>
                      {status.label}
                    </span>
                  </div>

                  {project.isShared && (
                    <div className="mb-2">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                        <Users className="w-3 h-3" />
                        Compartido · {project.sharedPermission === "edit" ? "Editar" : "Ver"}
                      </span>
                    </div>
                  )}

                  {project.description && (
                    <p className="text-sm text-slate-500 line-clamp-2 mb-3">{project.description}</p>
                  )}

                  {/* Task progress */}
                  {project.taskCount > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                        <span>{project.doneCount}/{project.taskCount} tareas</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", pct === 100 ? "bg-emerald-400" : "bg-[#1e3a5f]")}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className={cn("font-medium", priority.className)}>{priority.label}</span>
                      {project.range && <span>{rangeConfig[project.range]}</span>}
                      {project.category && (
                        <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{project.category}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {cycle.phase !== "none" && (
                        <span className={cn("px-1.5 py-0.5 rounded font-medium", cycle.badgeClass)}>
                          {cycle.label}
                        </span>
                      )}
                      {project.clientName && <span className="truncate max-w-[80px]">{project.clientName}</span>}
                      {project.endDate && <span>{formatDate(project.endDate)}</span>}
                    </div>
                  </div>
                </div>

                {cycle.phase !== "none" && (
                  <div className="h-1 bg-slate-100">
                    <div
                      className={cn("h-full transition-all duration-700", cycle.barColor)}
                      style={{ width: `${Math.min(cycle.pct, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ── TABLE VIEW ── */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3">
                    <button
                      onClick={() => toggleSort("name")}
                      className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-700"
                    >
                      Proyecto <SortIcon k="name" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
                  <th className="text-left px-4 py-3">
                    <button
                      onClick={() => toggleSort("priority")}
                      className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-700"
                    >
                      Prioridad <SortIcon k="priority" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Cliente</th>
                  <th className="text-left px-4 py-3">
                    <button
                      onClick={() => toggleSort("tasks")}
                      className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-700"
                    >
                      Tareas <SortIcon k="tasks" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">
                    <button
                      onClick={() => toggleSort("endDate")}
                      className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-700"
                    >
                      Vence <SortIcon k="endDate" />
                    </button>
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((project) => {
                  const status = statusConfig[project.status];
                  const priority = priorityConfig[project.priority];
                  const pct = project.taskCount > 0 ? Math.round((project.doneCount / project.taskCount) * 100) : 0;

                  return (
                    <tr
                      key={project.id}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedProject(project)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {project.privacy === "private" && <Lock className="w-3 h-3 text-slate-400 flex-shrink-0" />}
                          <span className="font-medium text-slate-800">{project.name}</span>
                          {project.isShared && (
                            <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">
                              <Users className="w-2.5 h-2.5" /> Compartido
                            </span>
                          )}
                        </div>
                        {project.category && (
                          <span className="text-xs text-slate-400">{project.category}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap", status.className)}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("flex items-center gap-1 text-xs font-medium", priority.className)}>
                          <Flag className="w-3 h-3" />
                          {priority.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-slate-500 text-xs">{project.clientName ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3">
                        {project.taskCount > 0 ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={cn("h-full rounded-full", pct === 100 ? "bg-emerald-400" : "bg-[#1e3a5f]")}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-500 whitespace-nowrap">
                              {project.doneCount}/{project.taskCount}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "text-xs whitespace-nowrap",
                          project.endDate && new Date(project.endDate) < new Date() && !["completed", "cancelled"].includes(project.status)
                            ? "text-red-500 font-medium"
                            : "text-slate-500"
                        )}>
                          {project.endDate ? formatDate(project.endDate) : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => router.push(`/projects/${project.id}`)}
                            className="p-1.5 rounded text-slate-400 hover:text-[#1e3a5f] hover:bg-slate-100 transition-colors"
                            title="Ver proyecto"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                          {!project.isShared && (
                            <>
                              <button
                                onClick={() => setMergeSourceId(project.id)}
                                className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                title="Mover tareas / Unificar"
                              >
                                <MoveRight className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => handleDelete(e, project)}
                                disabled={deletingId === project.id}
                                className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                                title="Eliminar"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Project detail modal */}
      {selectedProject && (
        <ProjectModal
          open={!!selectedProject}
          onClose={() => setSelectedProject(null)}
          project={selectedProject}
          clients={clients}
          objectives={objectives}
        />
      )}

      {/* Merge modal */}
      {mergeSourceId && (
        <ProjectMergeModal
          open={!!mergeSourceId}
          onClose={() => setMergeSourceId(null)}
          sourceId={mergeSourceId}
          projects={projectsForMerge}
        />
      )}
    </div>
  );
}
