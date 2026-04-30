"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { formatDate, cn } from "@/lib/utils";
import {
  Trash2, Lock, Users, Search, SlidersHorizontal, LayoutGrid, Table2,
  ArrowUpDown, Flag, MoveRight, ChevronUp, ChevronDown,
  X, DollarSign, Columns3, RotateCcw, Pencil, Share2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { ProjectForModal } from "./project-modal";
import { ProjectModal } from "./project-modal";
import { ProjectMergeModal } from "./project-merge-modal";
import { ShareModal } from "@/components/sharing/share-modal";
import { getCycleInfo } from "@/lib/cycles";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProjectWithCounts = ProjectForModal & {
  taskCount: number;
  doneCount: number;
  createdAt?: Date | string | null;
  totalAmount?: string | number | null;
};

type Client = { id: string; name: string };
type ObjectiveOption = { id: string; title: string };
type BusinessOption = { id: string; name: string };

type SortKey =
  | "name" | "status" | "priority" | "range" | "privacy" | "category"
  | "client" | "tasks" | "amount" | "startDate" | "endDate" | "createdAt" | "momentum";
type SortDir = "asc" | "desc";

type ColumnId =
  | "name" | "status" | "priority" | "range" | "privacy" | "category"
  | "client" | "tasks" | "amount" | "currency" | "startDate" | "endDate"
  | "createdAt" | "shared" | "cycle" | "momentum";

type ColumnDef = {
  id: ColumnId;
  label: string;
  description: string;
  sortKey: SortKey | null;
  defaultVisible: boolean;
  fixed?: boolean;
};

type InitialFilters = {
  status?: string;
  priority?: string;
  range?: string;
  privacy?: string;
  owner?: string;
  clientId?: string;
  category?: string;
  search?: string;
  sort?: string;
};

// ─── Column registry ──────────────────────────────────────────────────────────

const COLUMNS: ColumnDef[] = [
  { id: "name",      label: "Proyecto",    description: "Nombre, privacidad y categoría",    sortKey: "name",      defaultVisible: true,  fixed: true },
  { id: "status",    label: "Estado",      description: "Planning / Activo / Pausado…",       sortKey: "status",    defaultVisible: true },
  { id: "priority",  label: "Prioridad",   description: "Alta / Media / Baja",                sortKey: "priority",  defaultVisible: true },
  { id: "range",     label: "Rango",       description: "Corto o largo plazo",                sortKey: "range",     defaultVisible: true },
  { id: "privacy",   label: "Privacidad",  description: "Privado o público",                  sortKey: "privacy",   defaultVisible: false },
  { id: "category",  label: "Categoría",   description: "Etiqueta de categoría",              sortKey: "category",  defaultVisible: false },
  { id: "client",    label: "Cliente",     description: "Cliente asociado al proyecto",        sortKey: "client",    defaultVisible: true },
  { id: "shared",    label: "Compartido",  description: "Si es compartido y con qué permiso", sortKey: null,        defaultVisible: false },
  { id: "tasks",     label: "Tareas",      description: "Progreso: hechas / total",           sortKey: "tasks",     defaultVisible: true },
  { id: "amount",    label: "Presupuesto", description: "Monto total del proyecto",           sortKey: "amount",    defaultVisible: true },
  { id: "currency",  label: "Moneda",      description: "Divisa del presupuesto",             sortKey: null,        defaultVisible: false },
  { id: "startDate", label: "Inicio",      description: "Fecha de inicio",                    sortKey: "startDate", defaultVisible: false },
  { id: "endDate",   label: "Vence",       description: "Fecha de vencimiento",               sortKey: "endDate",   defaultVisible: true },
  { id: "createdAt", label: "Creado",      description: "Fecha de creación",                  sortKey: "createdAt", defaultVisible: false },
  { id: "cycle",     label: "Ciclo",       description: "Fase del ciclo de revisión",         sortKey: null,        defaultVisible: false },
  { id: "momentum",  label: "Momentum",    description: "Puntuación de momentum del ciclo",   sortKey: "momentum",  defaultVisible: false },
];

const COL_MAP = Object.fromEntries(COLUMNS.map((c) => [c.id, c])) as Record<ColumnId, ColumnDef>;
const DEFAULT_VISIBLE = COLUMNS.filter((c) => c.defaultVisible).map((c) => c.id);
const STORAGE_COLS = "projects-table-columns";

// ─── Status / priority config ─────────────────────────────────────────────────

const statusConfig = {
  planning:  { label: "Planeación", className: "bg-slate-100 text-slate-600" },
  active:    { label: "Activo",     className: "bg-emerald-50 text-emerald-700" },
  paused:    { label: "Pausado",    className: "bg-amber-50 text-amber-700" },
  completed: { label: "Completado", className: "bg-blue-50 text-blue-700" },
  cancelled: { label: "Cancelado",  className: "bg-red-50 text-red-700" },
};

const priorityConfig = {
  low:    { label: "Baja",  className: "text-slate-400" },
  medium: { label: "Media", className: "text-amber-500" },
  high:   { label: "Alta",  className: "text-orange-500" },
};

const rangeConfig: Record<string, string> = { short: "Corto", long: "Largo" };

const PRIORITY_ORDER: Record<string, number> = { low: 0, medium: 1, high: 2 };
const STATUS_ORDER:   Record<string, number> = { planning: 0, active: 1, paused: 2, completed: 3, cancelled: 4 };
const RANGE_ORDER:    Record<string, number> = { short: 0, long: 1 };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseSort(sort?: string): { key: SortKey; dir: SortDir } {
  if (!sort) return { key: "createdAt", dir: "desc" };
  const i = sort.lastIndexOf("-");
  if (i < 1) return { key: "createdAt", dir: "desc" };
  return { key: sort.slice(0, i) as SortKey, dir: sort.slice(i + 1) as SortDir };
}

function getView(): "grid" | "table" {
  if (typeof window === "undefined") return "grid";
  return (localStorage.getItem("projects-view") as "grid" | "table") ?? "grid";
}

function loadColumns(): ColumnId[] {
  if (typeof window === "undefined") return DEFAULT_VISIBLE;
  try {
    const raw = localStorage.getItem(STORAGE_COLS);
    if (raw) {
      const parsed = JSON.parse(raw) as ColumnId[];
      const valid = parsed.filter((id) => COLUMNS.some((c) => c.id === id));
      if (!valid.includes("name")) valid.unshift("name");
      return valid.length > 1 ? valid : DEFAULT_VISIBLE;
    }
  } catch { /* empty */ }
  return DEFAULT_VISIBLE;
}

function fmtMxn(v: string | number | null | undefined) {
  const n = Number(v ?? 0);
  if (!n) return "—";
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0 });
}

// Status quick-filter strip items
const STATUS_TABS = [
  { value: "all",       label: "Todos" },
  { value: "active",    label: "Activos" },
  { value: "planning",  label: "Planeación" },
  { value: "paused",    label: "Pausados" },
  { value: "completed", label: "Completados" },
  { value: "cancelled", label: "Cancelados" },
  { value: "overdue",   label: "⚠ Vencidos" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function ProjectsList({
  projects,
  clients,
  objectives,
  businesses,
  currentUserId,
  initialFilters,
}: {
  projects: ProjectWithCounts[];
  clients: Client[];
  objectives?: ObjectiveOption[];
  businesses?: BusinessOption[];
  currentUserId?: string;
  initialFilters?: InitialFilters;
}) {
  const router = useRouter();
  const initSort = parseSort(initialFilters?.sort);
  const colPickerRef = useRef<HTMLDivElement>(null);

  // ── Filters ──
  const [search,         setSearch]         = useState(initialFilters?.search   ?? "");
  const [statusFilter,   setStatusFilter]   = useState(initialFilters?.status   ?? "active");
  const [priorityFilter, setPriorityFilter] = useState(initialFilters?.priority ?? "all");
  const [rangeFilter,    setRangeFilter]    = useState(initialFilters?.range    ?? "all");
  const [privacyFilter,  setPrivacyFilter]  = useState(initialFilters?.privacy  ?? "all");
  const [ownerFilter,    setOwnerFilter]    = useState(initialFilters?.owner    ?? "all");
  const [clientFilter,   setClientFilter]   = useState(initialFilters?.clientId ?? "all");
  const [categoryFilter, setCategoryFilter] = useState(initialFilters?.category ?? "all");
  const [showAdvanced,   setShowAdvanced]   = useState(false);

  // ── Sort ──
  const [sortKey, setSortKey] = useState<SortKey>(initSort.key);
  const [sortDir, setSortDir] = useState<SortDir>(initSort.dir);

  // ── View + columns ──
  const [view,           setView]           = useState<"grid" | "table">("grid");
  const [visibleColumns, setVisibleColumns] = useState<ColumnId[]>(DEFAULT_VISIBLE);
  const [colPickerOpen,  setColPickerOpen]  = useState(false);

  // ── Modals ──
  const [editProject,   setEditProject]   = useState<ProjectWithCounts | null>(null);
  const [shareProject,  setShareProject]  = useState<{ id: string; name: string } | null>(null);
  const [mergeSourceId, setMergeSourceId] = useState<string | null>(null);
  const [deletingId,    setDeletingId]    = useState<string | null>(null);

  // ── Status change per-row ──
  const [rowStatuses, setRowStatuses] = useState<Record<string, string>>({});

  useEffect(() => { setView(getView()); setVisibleColumns(loadColumns()); }, []);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_COLS, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams();
    if (statusFilter   !== "active") p.set("status",   statusFilter);
    if (priorityFilter !== "all")    p.set("priority",  priorityFilter);
    if (rangeFilter    !== "all")    p.set("range",     rangeFilter);
    if (privacyFilter  !== "all")    p.set("privacy",   privacyFilter);
    if (ownerFilter    !== "all")    p.set("owner",     ownerFilter);
    if (clientFilter   !== "all")    p.set("client",    clientFilter);
    if (categoryFilter !== "all")    p.set("category",  categoryFilter);
    if (search)                       p.set("q",         search);
    const sortStr = `${sortKey}-${sortDir}`;
    if (sortStr !== "createdAt-desc") p.set("sort", sortStr);
    window.history.replaceState(null, "", p.toString() ? `?${p.toString()}` : window.location.pathname);
  }, [statusFilter, priorityFilter, rangeFilter, privacyFilter, ownerFilter, clientFilter, categoryFilter, search, sortKey, sortDir]);

  useEffect(() => {
    if (!colPickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) setColPickerOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [colPickerOpen]);

  function toggleView(v: "grid" | "table") { setView(v); localStorage.setItem("projects-view", v); }
  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }
  function clearAdvanced() {
    setPriorityFilter("all"); setRangeFilter("all"); setPrivacyFilter("all");
    setOwnerFilter("all"); setClientFilter("all"); setCategoryFilter("all");
  }

  const toggleColumn = useCallback((id: ColumnId) => {
    if (id === "name") return;
    setVisibleColumns((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);
  }, []);

  const moveColumn = useCallback((id: ColumnId, direction: "up" | "down") => {
    setVisibleColumns((prev) => {
      const idx = prev.indexOf(id);
      if (idx < 0) return prev;
      const minIdx = prev[0] === "name" ? 1 : 0;
      const newIdx = direction === "up" ? Math.max(minIdx, idx - 1) : Math.min(prev.length - 1, idx + 1);
      if (newIdx === idx) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
  }, []);

  async function handleRowStatusChange(projectId: string, newStatus: string) {
    setRowStatuses((prev) => ({ ...prev, [projectId]: newStatus }));
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    router.refresh();
  }

  const availableCategories = useMemo(
    () => [...new Set(projects.map((p) => p.category).filter(Boolean) as string[])].sort(),
    [projects]
  );

  const advancedActive = [
    priorityFilter !== "all", rangeFilter !== "all", privacyFilter !== "all",
    ownerFilter !== "all", clientFilter !== "all", categoryFilter !== "all",
  ].filter(Boolean).length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filtered = useMemo(() => {
    const todayTs = new Date(); todayTs.setHours(0,0,0,0);
    let list = [...projects];

    if (statusFilter === "overdue") {
      list = list.filter((p) => p.endDate && new Date(p.endDate) < todayTs && p.status !== "completed" && p.status !== "cancelled");
    } else if (statusFilter !== "all") {
      list = list.filter((p) => p.status === statusFilter);
    }
    if (priorityFilter !== "all") list = list.filter((p) => p.priority === priorityFilter);
    if (rangeFilter    !== "all") list = list.filter((p) => p.range    === rangeFilter);
    if (privacyFilter  !== "all") list = list.filter((p) => p.privacy  === privacyFilter);
    if (ownerFilter === "mine")   list = list.filter((p) => !p.isShared);
    else if (ownerFilter === "shared") list = list.filter((p) => p.isShared);
    if (clientFilter   !== "all") list = list.filter((p) => p.clientId   === clientFilter);
    if (categoryFilter !== "all") list = list.filter((p) => p.category   === categoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q) || (p.clientName ?? "").toLowerCase().includes(q) || (p.category ?? "").toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":      cmp = a.name.localeCompare(b.name); break;
        case "status":    cmp = (STATUS_ORDER[a.status]   ?? 0) - (STATUS_ORDER[b.status]   ?? 0); break;
        case "priority":  cmp = (PRIORITY_ORDER[a.priority] ?? 0) - (PRIORITY_ORDER[b.priority] ?? 0); break;
        case "range":     cmp = (RANGE_ORDER[a.range ?? ""] ?? 2) - (RANGE_ORDER[b.range ?? ""] ?? 2); break;
        case "privacy":   cmp = (a.privacy   ?? "").localeCompare(b.privacy   ?? ""); break;
        case "category":  cmp = (a.category  ?? "").localeCompare(b.category  ?? ""); break;
        case "client":    cmp = (a.clientName ?? "").localeCompare(b.clientName ?? ""); break;
        case "tasks":     cmp = a.taskCount - b.taskCount; break;
        case "amount":    cmp = Number(a.totalAmount ?? 0) - Number(b.totalAmount ?? 0); break;
        case "startDate": { const da = a.startDate ? new Date(a.startDate).getTime() : Infinity; const db2 = b.startDate ? new Date(b.startDate).getTime() : Infinity; cmp = da - db2; break; }
        case "endDate":   { const da = a.endDate ? new Date(a.endDate).getTime() : Infinity; const db2 = b.endDate ? new Date(b.endDate).getTime() : Infinity; cmp = da - db2; break; }
        case "momentum":  cmp = (a.momentum ?? 100) - (b.momentum ?? 100); break;
        default: cmp = new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [projects, statusFilter, priorityFilter, rangeFilter, privacyFilter, ownerFilter, clientFilter, categoryFilter, search, sortKey, sortDir]);

  async function handleDelete(e: React.MouseEvent, project: ProjectWithCounts) {
    e.stopPropagation();
    if (!confirm(`¿Eliminar "${project.name}"?`)) return;
    setDeletingId(project.id);
    try { await fetch(`/api/projects/${project.id}`, { method: "DELETE" }); router.refresh(); }
    finally { setDeletingId(null); }
  }

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k
      ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
      : <ArrowUpDown className="w-3 h-3 opacity-30" />;

  const projectsForMerge = useMemo(() => projects.map((p) => ({ id: p.id, name: p.name, taskCount: p.taskCount })), [projects]);

  const pickerOrder = useMemo(() => {
    const hidden = COLUMNS.map((c) => c.id).filter((id) => !visibleColumns.includes(id));
    return [...visibleColumns, ...hidden];
  }, [visibleColumns]);

  // ── Render cell ────────────────────────────────────────────────────────────
  function renderCell(colId: ColumnId, p: ProjectWithCounts) {
    const effectiveStatus = rowStatuses[p.id] ?? p.status;
    const isOverdue = p.endDate && new Date(p.endDate) < today && !["completed", "cancelled"].includes(effectiveStatus);
    const st = statusConfig[effectiveStatus as keyof typeof statusConfig] ?? statusConfig.active;
    const pr = priorityConfig[p.priority];
    const pct = p.taskCount > 0 ? Math.round((p.doneCount / p.taskCount) * 100) : 0;
    const cy = getCycleInfo(p.cycleMinutes, p.lastCycleAt, p.nextCycleAt);

    switch (colId) {
      case "name": return (
        <td key="name" className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            {p.privacy === "private" && <Lock className="w-3 h-3 text-slate-400 flex-shrink-0" />}
            <span className="font-medium text-slate-800 truncate max-w-[200px]">{p.name}</span>
            {p.isShared && <Users className="w-3 h-3 text-blue-400 flex-shrink-0" />}
          </div>
          {p.category && <p className="text-[10px] text-slate-400 mt-0.5">{p.category}</p>}
        </td>
      );
      case "status": return (
        <td key="status" className="px-4 py-3">
          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap", st.className)}>{st.label}</span>
        </td>
      );
      case "priority": return (
        <td key="priority" className="px-4 py-3">
          <span className={cn("flex items-center gap-1 text-xs font-medium", pr.className)}>
            <Flag className="w-3 h-3" />{pr.label}
          </span>
        </td>
      );
      case "range": return <td key="range" className="px-4 py-3"><span className="text-xs text-slate-500">{p.range ? rangeConfig[p.range] : "—"}</span></td>;
      case "privacy": return (
        <td key="privacy" className="px-4 py-3">
          <span className="flex items-center gap-1 text-xs text-slate-500">
            {p.privacy === "private" ? <><Lock className="w-3 h-3" />Privado</> : "Público"}
          </span>
        </td>
      );
      case "category": return <td key="category" className="px-4 py-3"><span className="text-xs text-slate-500">{p.category ?? "—"}</span></td>;
      case "client": return <td key="client" className="px-4 py-3"><span className="text-xs text-slate-500">{p.clientName ?? "—"}</span></td>;
      case "shared": return (
        <td key="shared" className="px-4 py-3">
          {p.isShared
            ? <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full"><Users className="w-2.5 h-2.5" />{p.sharedPermission === "edit" ? "Editar" : "Ver"}</span>
            : <span className="text-xs text-slate-300">—</span>}
        </td>
      );
      case "tasks": return (
        <td key="tasks" className="px-4 py-3">
          {p.taskCount > 0
            ? <div className="flex items-center gap-2"><div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className={cn("h-full rounded-full", pct === 100 ? "bg-emerald-400" : "bg-[#1e3a5f]")} style={{ width: `${pct}%` }} /></div><span className="text-xs text-slate-500 whitespace-nowrap">{p.doneCount}/{p.taskCount}</span></div>
            : <span className="text-xs text-slate-300">—</span>}
        </td>
      );
      case "amount": return <td key="amount" className="px-4 py-3"><span className="text-xs text-slate-600">{fmtMxn(p.totalAmount)}</span></td>;
      case "currency": return <td key="currency" className="px-4 py-3"><span className="text-xs text-slate-400">{(p as { currency?: string }).currency ?? "MXN"}</span></td>;
      case "startDate": return <td key="startDate" className="px-4 py-3"><span className="text-xs text-slate-500">{p.startDate ? formatDate(p.startDate) : "—"}</span></td>;
      case "endDate": return (
        <td key="endDate" className="px-4 py-3">
          <span className={cn("text-xs whitespace-nowrap", isOverdue ? "text-red-500 font-medium" : "text-slate-500")}>
            {p.endDate ? formatDate(p.endDate) : "—"}
          </span>
        </td>
      );
      case "createdAt": return <td key="createdAt" className="px-4 py-3"><span className="text-xs text-slate-400">{p.createdAt ? formatDate(String(p.createdAt)) : "—"}</span></td>;
      case "cycle": return (
        <td key="cycle" className="px-4 py-3">
          {cy.phase !== "none"
            ? <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", cy.badgeClass)}>{cy.label}</span>
            : <span className="text-xs text-slate-300">—</span>}
        </td>
      );
      case "momentum": return (
        <td key="momentum" className="px-4 py-3">
          <span className={cn("text-xs font-medium", (p.momentum ?? 100) >= 80 ? "text-emerald-600" : (p.momentum ?? 100) >= 50 ? "text-amber-500" : "text-red-500")}>
            {p.momentum ?? 100}
          </span>
        </td>
      );
      default: return <td key={colId} />;
    }
  }

  function renderHeader(colId: ColumnId) {
    const col = COL_MAP[colId];
    if (!col) return <th key={colId} />;
    return (
      <th key={colId} className="text-left px-4 py-3">
        {col.sortKey
          ? <button onClick={() => toggleSort(col.sortKey as SortKey)} className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-800 transition-colors">{col.label}<SortIcon k={col.sortKey as SortKey} /></button>
          : <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{col.label}</span>}
      </th>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Controls bar ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 bg-white"
          />
        </div>

        <select
          value={`${sortKey}-${sortDir}`}
          onChange={(e) => { const val = e.target.value; const i = val.lastIndexOf("-"); setSortKey(val.slice(0,i) as SortKey); setSortDir(val.slice(i+1) as SortDir); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none bg-white"
        >
          <option value="createdAt-desc">Más recientes</option>
          <option value="createdAt-asc">Más antiguos</option>
          <option value="priority-desc">Prioridad ↓</option>
          <option value="priority-asc">Prioridad ↑</option>
          <option value="status-asc">Estado</option>
          <option value="endDate-asc">Vence pronto</option>
          <option value="endDate-desc">Vence tarde</option>
          <option value="name-asc">Nombre A→Z</option>
          <option value="name-desc">Nombre Z→A</option>
          <option value="client-asc">Cliente</option>
          <option value="tasks-desc">Más tareas</option>
          <option value="amount-desc">Mayor presupuesto</option>
          <option value="momentum-desc">Momentum alto</option>
        </select>

        {/* Advanced filters toggle */}
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm transition-colors",
            showAdvanced || advancedActive > 0
              ? "border-[#1e3a5f] text-[#1e3a5f] bg-[#1e3a5f]/5"
              : "border-slate-200 text-slate-600 bg-white hover:bg-slate-50"
          )}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filtros
          {advancedActive > 0 && <span className="w-1.5 h-1.5 rounded-full bg-[#1e3a5f] flex-shrink-0" />}
        </button>

        {/* Clear */}
        {(search || statusFilter !== "active" || advancedActive > 0) && (
          <button
            onClick={() => { setSearch(""); setStatusFilter("active"); clearAdvanced(); }}
            className="flex items-center gap-1 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-500 bg-white hover:bg-slate-50 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Column picker */}
        {view === "table" && (
          <div className="relative" ref={colPickerRef}>
            <button
              onClick={() => setColPickerOpen((v) => !v)}
              className={cn("flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm transition-colors", colPickerOpen ? "border-[#1e3a5f] text-[#1e3a5f] bg-[#1e3a5f]/5" : "border-slate-200 text-slate-600 bg-white hover:bg-slate-50")}
            >
              <Columns3 className="w-4 h-4" />
              <span className="text-[10px] font-mono text-slate-400">{visibleColumns.length}</span>
            </button>
            {colPickerOpen && (
              <div className="absolute top-full mt-1.5 right-0 z-50 w-72 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
                  <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Columnas</span>
                  <button onClick={() => setVisibleColumns(DEFAULT_VISIBLE)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                </div>
                <div className="max-h-96 overflow-y-auto divide-y divide-slate-50">
                  {pickerOrder.map((colId) => {
                    const col = COL_MAP[colId];
                    const isOn = visibleColumns.includes(colId);
                    const isFixed = col.fixed;
                    const idx = visibleColumns.indexOf(colId);
                    const minIdx = visibleColumns[0] === "name" ? 1 : 0;
                    return (
                      <div key={colId} className={cn("flex items-center gap-2 px-3 py-2.5 transition-colors", isFixed ? "bg-slate-50/60" : "hover:bg-slate-50")}>
                        <button
                          onClick={() => toggleColumn(colId)}
                          disabled={isFixed}
                          className={cn("flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors", isOn ? isFixed ? "bg-slate-300 border-slate-300" : "bg-[#1e3a5f] border-[#1e3a5f]" : "bg-white border-slate-300 hover:border-slate-400")}
                        >
                          {isOn && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm font-medium", isOn ? "text-slate-800" : "text-slate-400")}>{col.label}</p>
                          <p className="text-[10px] text-slate-400 truncate">{col.description}</p>
                        </div>
                        {isOn && !isFixed && (
                          <div className="flex flex-col gap-0.5">
                            <button onClick={() => moveColumn(colId, "up")} disabled={idx <= minIdx} className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-20"><ChevronUp className="w-3.5 h-3.5" /></button>
                            <button onClick={() => moveColumn(colId, "down")} disabled={idx === visibleColumns.length - 1} className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-20"><ChevronDown className="w-3.5 h-3.5" /></button>
                          </div>
                        )}
                        {col.sortKey && <ArrowUpDown className="w-3 h-3 text-slate-300 flex-shrink-0" />}
                      </div>
                    );
                  })}
                </div>
                <div className="px-4 py-2 border-t border-slate-100 bg-slate-50">
                  <p className="text-[10px] text-slate-400">{visibleColumns.length}/{COLUMNS.length} visibles</p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex border border-slate-200 rounded-lg overflow-hidden">
          <button onClick={() => toggleView("grid")} className={cn("px-3 py-2 transition-colors", view === "grid" ? "bg-[#1e3a5f] text-white" : "bg-white text-slate-500 hover:bg-slate-50")} title="Tarjetas"><LayoutGrid className="w-4 h-4" /></button>
          <button onClick={() => toggleView("table")} className={cn("px-3 py-2 transition-colors border-l border-slate-200", view === "table" ? "bg-[#1e3a5f] text-white" : "bg-white text-slate-500 hover:bg-slate-50")} title="Tabla"><Table2 className="w-4 h-4" /></button>
        </div>
      </div>

      {/* ── Status quick-filter strip (always visible, scrollable) ── */}
      <div className="flex overflow-x-auto scrollbar-none gap-1.5 pb-0.5">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all border",
              statusFilter === tab.value
                ? "bg-[#1e3a5f] text-white border-[#1e3a5f] shadow-sm"
                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Advanced filters panel (compact selects only) ── */}
      {showAdvanced && (
        <div className="flex flex-wrap gap-3 p-3.5 bg-slate-50 rounded-lg border border-slate-200 items-center">
          <span className="text-xs font-medium text-slate-500">Filtrar por:</span>
          {[
            { label: "Prioridad", value: priorityFilter, onChange: setPriorityFilter, options: [["all","Todas"],["high","Alta"],["medium","Media"],["low","Baja"]] },
            { label: "Rango",     value: rangeFilter,    onChange: setRangeFilter,    options: [["all","Todos"],["short","Corto"],["long","Largo"]] },
            { label: "Privacidad",value: privacyFilter,  onChange: setPrivacyFilter,  options: [["all","Todos"],["private","Privado"],["public","Público"]] },
            { label: "Dueño",     value: ownerFilter,    onChange: setOwnerFilter,    options: [["all","Todos"],["mine","Míos"],["shared","Compartidos"]] },
          ].map((f) => (
            <select
              key={f.label}
              value={f.value}
              onChange={(e) => f.onChange(e.target.value)}
              className={cn(
                "px-2.5 py-1.5 border rounded-lg text-xs text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]/30 transition-colors",
                f.value !== "all" ? "border-[#1e3a5f]/40 text-[#1e3a5f] font-medium" : "border-slate-200"
              )}
            >
              {f.options.map(([v, l]) => <option key={v} value={v}>{f.label}: {l}</option>)}
            </select>
          ))}
          {clients.length > 0 && (
            <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className={cn("px-2.5 py-1.5 border rounded-lg text-xs text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]/30", clientFilter !== "all" ? "border-[#1e3a5f]/40 text-[#1e3a5f] font-medium" : "border-slate-200")}>
              <option value="all">Cliente: Todos</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {availableCategories.length > 0 && (
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={cn("px-2.5 py-1.5 border rounded-lg text-xs text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]/30", categoryFilter !== "all" ? "border-[#1e3a5f]/40 text-[#1e3a5f] font-medium" : "border-slate-200")}>
              <option value="all">Categoría: Todas</option>
              {availableCategories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          {advancedActive > 0 && (
            <button onClick={clearAdvanced} className="text-xs text-slate-400 hover:text-slate-600 transition-colors underline">Limpiar</button>
          )}
        </div>
      )}

      {/* Results count */}
      {filtered.length !== projects.length && (
        <p className="text-xs text-slate-400">{filtered.length} de {projects.length} proyectos</p>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-200">
          <p className="mb-2">No hay proyectos con estos filtros</p>
          <button onClick={() => { setStatusFilter("active"); clearAdvanced(); setSearch(""); }} className="text-xs text-[#1e3a5f] hover:underline">Limpiar filtros</button>
        </div>
      ) : view === "grid" ? (
        /* ── GRID VIEW ── */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((project) => {
            const effectiveStatus = rowStatuses[project.id] ?? project.status;
            const status   = statusConfig[effectiveStatus as keyof typeof statusConfig] ?? statusConfig.active;
            const priority = priorityConfig[project.priority];
            const cycle    = getCycleInfo(project.cycleMinutes, project.lastCycleAt, project.nextCycleAt);
            const pct      = project.taskCount > 0 ? Math.round((project.doneCount / project.taskCount) * 100) : 0;
            const isOverdue = project.endDate && new Date(project.endDate) < today && !["completed", "cancelled"].includes(effectiveStatus);

            return (
              <div
                key={project.id}
                onClick={() => router.push(`/projects/${project.id}`)}
                className={cn("group relative bg-white rounded-xl border overflow-hidden hover:shadow-sm transition-all cursor-pointer", isOverdue ? "border-red-200 hover:border-red-300" : "border-slate-200 hover:border-slate-300")}
              >
                <div className="p-5">
                  {/* Hover actions overlay */}
                  <div className="absolute top-3 right-3 hidden group-hover:flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); setEditProject(project); }} className="p-1.5 rounded-lg text-slate-400 hover:text-[#1e3a5f] hover:bg-slate-50 transition-colors" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={(e) => { e.stopPropagation(); setShareProject({ id: project.id, name: project.name }); }} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Compartir"><Share2 className="w-3.5 h-3.5" /></button>
                    {!project.isShared && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); setMergeSourceId(project.id); }} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Unificar"><MoveRight className="w-3.5 h-3.5" /></button>
                        <button onClick={(e) => handleDelete(e, project)} disabled={deletingId === project.id} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
                      </>
                    )}
                  </div>

                  <div className="flex items-start justify-between mb-3 pr-16">
                    <h3 className="font-semibold text-slate-900 line-clamp-1 flex items-center gap-1.5">
                      {project.privacy === "private" && <Lock className="w-3 h-3 text-slate-400 flex-shrink-0" />}
                      {project.name}
                    </h3>
                    <span className={cn("ml-2 text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap flex-shrink-0", status.className)}>{status.label}</span>
                  </div>

                  {project.isShared && (
                    <div className="mb-2">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                        <Users className="w-3 h-3" /> Compartido · {project.sharedPermission === "edit" ? "Editar" : "Ver"}
                      </span>
                    </div>
                  )}

                  {project.description && <p className="text-sm text-slate-500 line-clamp-2 mb-3">{project.description}</p>}

                  {project.taskCount > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                        <span>{project.doneCount}/{project.taskCount} tareas</span><span>{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", pct === 100 ? "bg-emerald-400" : "bg-[#1e3a5f]")} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className={cn("font-medium", priority.className)}>{priority.label}</span>
                      {project.range && <span>{rangeConfig[project.range]}</span>}
                      {project.category && <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{project.category}</span>}
                      {project.totalAmount && Number(project.totalAmount) > 0 && (
                        <span className="flex items-center gap-0.5 text-emerald-600"><DollarSign className="w-3 h-3" />{Number(project.totalAmount).toLocaleString("es-MX")}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {cycle.phase !== "none" && <span className={cn("px-1.5 py-0.5 rounded font-medium", cycle.badgeClass)}>{cycle.label}</span>}
                      {project.clientName && <span className="truncate max-w-[80px]">{project.clientName}</span>}
                      {project.endDate && <span className={cn(isOverdue && "text-red-500 font-medium")}>{formatDate(project.endDate)}</span>}
                    </div>
                  </div>
                </div>
                {cycle.phase !== "none" && (
                  <div className="h-1 bg-slate-100"><div className={cn("h-full transition-all duration-700", cycle.barColor)} style={{ width: `${Math.min(cycle.pct, 100)}%` }} /></div>
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
                  {visibleColumns.map((colId) => renderHeader(colId))}
                  <th className="px-4 py-3 text-right">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((project) => {
                  const effectiveStatus = rowStatuses[project.id] ?? project.status;
                  const isOverdue = project.endDate && new Date(project.endDate) < today && !["completed","cancelled"].includes(effectiveStatus);
                  return (
                    <tr
                      key={project.id}
                      className={cn("group hover:bg-slate-50 transition-colors cursor-pointer", isOverdue && "bg-red-50/20")}
                      onClick={() => router.push(`/projects/${project.id}`)}
                    >
                      {visibleColumns.map((colId) => renderCell(colId, project))}
                      <td className="px-3 py-3">
                        <div
                          className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Quick status change */}
                          <select
                            value={rowStatuses[project.id] ?? project.status}
                            onChange={(e) => handleRowStatusChange(project.id, e.target.value)}
                            className="text-xs border border-slate-200 rounded px-1.5 py-1 text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]/30 cursor-pointer"
                          >
                            <option value="planning">Planeación</option>
                            <option value="active">Activo</option>
                            <option value="paused">Pausado</option>
                            <option value="completed">Completado</option>
                            <option value="cancelled">Cancelado</option>
                          </select>
                          <button onClick={() => setEditProject(project)} className="p-1.5 rounded text-slate-400 hover:text-[#1e3a5f] hover:bg-slate-100 transition-colors" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setShareProject({ id: project.id, name: project.name })} className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Compartir"><Share2 className="w-3.5 h-3.5" /></button>
                          {!project.isShared && (
                            <>
                              <button onClick={() => setMergeSourceId(project.id)} className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Unificar"><MoveRight className="w-3.5 h-3.5" /></button>
                              <button onClick={(e) => handleDelete(e, project)} disabled={deletingId === project.id} className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
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

      {/* Modals */}
      {editProject && (
        <ProjectModal
          open={!!editProject}
          onClose={() => setEditProject(null)}
          project={editProject}
          clients={clients}
          objectives={objectives}
          businesses={businesses}
          initialMode="edit"
        />
      )}
      {shareProject && (
        <ShareModal
          resourceType="project"
          resourceId={shareProject.id}
          resourceTitle={shareProject.name}
          onClose={() => setShareProject(null)}
        />
      )}
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
