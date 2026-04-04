"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Search, ChevronLeft, ChevronRight, MessageSquare, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type LeadStatus =
  | "nuevo" | "pendiente" | "contactado" | "interesado"
  | "no_responde" | "sin_whatsapp" | "descartado" | "cerrado";

export interface LeadRow {
  id: string;
  name: string | null;
  niche: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  status: LeadStatus;
  score: number | null;
  hasWhatsapp: number | null;
  rating: number | null;
  templateUsed: string | null;
  contactedAt: string | null;
  lastActivity: string | null;
  campaignId: string | null;
  webSource: string | null;
}

interface FilterOptions {
  niches: string[];
  cities: string[];
  campaigns: { id: string; title: string }[];
}

interface Props {
  initialLeads: LeadRow[];
  totalCount: number;
  filterOptions: FilterOptions;
}

// ── Configuración visual ──────────────────────────────────────────────────────

const STATUS_CONFIG: Record<LeadStatus, { label: string; row: string; badge: string }> = {
  nuevo:        { label: "Nuevo",        row: "",                         badge: "bg-blue-100 text-blue-700" },
  pendiente:    { label: "Pendiente",    row: "bg-cyan-50/40",            badge: "bg-cyan-100 text-cyan-700" },
  contactado:   { label: "Contactado",   row: "bg-yellow-50/40",          badge: "bg-yellow-100 text-yellow-700" },
  interesado:   { label: "Interesado",   row: "bg-emerald-50/50",         badge: "bg-emerald-100 text-emerald-700" },
  no_responde:  { label: "Sin respuesta",row: "bg-slate-50/60",           badge: "bg-slate-100 text-slate-500" },
  sin_whatsapp: { label: "Sin WA",       row: "bg-orange-50/40",          badge: "bg-orange-100 text-orange-700" },
  descartado:   { label: "Descartado",   row: "bg-red-50/30 opacity-70",  badge: "bg-red-100 text-red-600" },
  cerrado:      { label: "Cerrado",      row: "bg-purple-50/40",          badge: "bg-purple-100 text-purple-700" },
};

const ALL_STATUSES = Object.keys(STATUS_CONFIG) as LeadStatus[];

const SCORE_COLOR = (s: number | null) => {
  if (!s) return "bg-slate-200 text-slate-500";
  if (s >= 8) return "bg-emerald-100 text-emerald-700";
  if (s >= 5) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-600";
};

const WA_BADGE = (v: number | null) => {
  if (v === 1) return <span className="text-emerald-600 font-bold text-xs">✓ WA</span>;
  if (v === 0) return <span className="text-red-400 text-xs">✗</span>;
  return <span className="text-slate-300 text-xs">?</span>;
};

function relativeTime(d: string | null): string {
  if (!d) return "—";
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  return new Date(d).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

// ── Componente ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export function LeadsTable({ initialLeads, totalCount, filterOptions }: Props) {
  const [leads, setLeads] = useState<LeadRow[]>(initialLeads);
  const [total, setTotal] = useState(totalCount);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);

  // Filtros
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [nicheFilter, setNicheFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("");
  const [waFilter, setWaFilter] = useState<"all" | "yes" | "no" | "unknown">("all");
  const [showFilters, setShowFilters] = useState(false);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchLeads = useCallback(async (opts: {
    q: string; status: string; niche: string; city: string;
    campaign: string; wa: string; pg: number;
  }) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (opts.q) params.set("q", opts.q);
      if (opts.status !== "all") params.set("status", opts.status);
      if (opts.niche) params.set("niche", opts.niche);
      if (opts.city) params.set("city", opts.city);
      if (opts.campaign) params.set("campaignId", opts.campaign);
      if (opts.wa !== "all") params.set("hasWhatsapp", opts.wa);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(opts.pg * PAGE_SIZE));
      params.set("withCount", "true");

      const res = await fetch(`/api/mkt/leads?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(Array.isArray(data) ? data : data.rows ?? []);
        if (!Array.isArray(data) && data.total !== undefined) setTotal(data.total);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch cuando cambian filtros (con debounce en search)
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setPage(0);
      fetchLeads({ q: search, status: statusFilter, niche: nicheFilter, city: cityFilter, campaign: campaignFilter, wa: waFilter, pg: 0 });
    }, search ? 400 : 0);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [search, statusFilter, nicheFilter, cityFilter, campaignFilter, waFilter, fetchLeads]);

  // Cambio de página
  useEffect(() => {
    if (page === 0) return; // evitar doble fetch en primer render
    fetchLeads({ q: search, status: statusFilter, niche: nicheFilter, city: cityFilter, campaign: campaignFilter, wa: waFilter, pg: page });
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  async function quickStatusChange(id: string, newStatus: LeadStatus) {
    const res = await fetch(`/api/mkt/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setLeads((prev) => prev.map((l) => l.id === id ? { ...l, status: newStatus } : l));
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const activeFiltersCount = [
    statusFilter !== "all", nicheFilter, cityFilter, campaignFilter, waFilter !== "all",
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Barra de búsqueda + filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, teléfono o email..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors",
            showFilters || activeFiltersCount > 0
              ? "border-[#1e3a5f] bg-[#1e3a5f]/5 text-[#1e3a5f]"
              : "border-slate-200 text-slate-600 hover:border-slate-300"
          )}
        >
          <Filter className="w-4 h-4" />
          Filtros {activeFiltersCount > 0 && <span className="bg-[#1e3a5f] text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">{activeFiltersCount}</span>}
        </button>

        <span className="text-sm text-slate-400 ml-auto">
          {loading ? "Cargando..." : `${total.toLocaleString()} leads`}
        </span>
      </div>

      {/* Panel de filtros expandible */}
      {showFilters && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Estado</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as LeadStatus | "all")} className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none">
              <option value="all">Todos</option>
              {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Nicho</label>
            <select value={nicheFilter} onChange={(e) => setNicheFilter(e.target.value)} className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none">
              <option value="">Todos</option>
              {filterOptions.niches.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Ciudad</label>
            <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none">
              <option value="">Todas</option>
              {filterOptions.cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">WhatsApp</label>
            <select value={waFilter} onChange={(e) => setWaFilter(e.target.value as typeof waFilter)} className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none">
              <option value="all">Todos</option>
              <option value="yes">Confirmado ✓</option>
              <option value="no">Sin WA ✗</option>
              <option value="unknown">Sin verificar ?</option>
            </select>
          </div>
          {filterOptions.campaigns.length > 0 && (
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-500 block mb-1">Campaña</label>
              <select value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)} className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none">
                <option value="">Todas</option>
                {filterOptions.campaigns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
          )}
          {activeFiltersCount > 0 && (
            <div className="col-span-2 md:col-span-4 flex justify-end">
              <button onClick={() => { setStatusFilter("all"); setNicheFilter(""); setCityFilter(""); setCampaignFilter(""); setWaFilter("all"); }} className="text-xs text-slate-500 hover:text-red-500 transition-colors">
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      )}

      {/* Pills de status rápido */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setStatusFilter("all")} className={cn("whitespace-nowrap px-3 py-1 text-xs font-medium rounded-full transition-colors", statusFilter === "all" ? "bg-[#1e3a5f] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
          Todos
        </button>
        {ALL_STATUSES.map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} className={cn("whitespace-nowrap px-3 py-1 text-xs font-medium rounded-full transition-colors", statusFilter === s ? STATUS_CONFIG[s].badge + " ring-1 ring-current" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>
            {STATUS_CONFIG[s].label}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-400 text-sm">Cargando leads...</div>
        ) : leads.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No hay leads con estos filtros.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Negocio</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Teléfono</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Score</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">WA</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Últ. actividad</th>
                  <th className="px-3 py-3 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {leads.map((lead) => {
                  const sc = STATUS_CONFIG[lead.status] ?? STATUS_CONFIG.nuevo;
                  return (
                    <tr key={lead.id} className={cn("hover:bg-slate-50 transition-colors group", sc.row)}>
                      <td className="px-4 py-3">
                        <div>
                          <span className="font-medium text-slate-800 group-hover:text-[#1e3a5f] transition-colors line-clamp-1">
                            {lead.name ?? "Sin nombre"}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {lead.niche && <span className="text-xs text-indigo-600">{lead.niche}</span>}
                            {lead.niche && lead.city && <span className="text-slate-300 text-xs">·</span>}
                            {lead.city && <span className="text-xs text-slate-400">{lead.city}</span>}
                            {lead.rating != null && lead.rating > 0 && (
                              <span className="text-xs text-amber-500">★ {lead.rating.toFixed(1)}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 hidden md:table-cell">
                        <span className="text-slate-600 font-mono text-xs">{lead.phone ?? "—"}</span>
                      </td>
                      <td className="px-3 py-3">
                        <select
                          value={lead.status}
                          onChange={(e) => quickStatusChange(lead.id, e.target.value as LeadStatus)}
                          onClick={(e) => e.stopPropagation()}
                          className={cn("text-xs font-medium px-2 py-0.5 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20", sc.badge)}
                        >
                          {ALL_STATUSES.map((s) => (
                            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3 text-center hidden sm:table-cell">
                        {lead.score != null ? (
                          <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", SCORE_COLOR(lead.score))}>
                            {lead.score}
                          </span>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-3 text-center hidden sm:table-cell">
                        {WA_BADGE(lead.hasWhatsapp)}
                      </td>
                      <td className="px-3 py-3 hidden lg:table-cell">
                        <span className="text-xs text-slate-400">
                          {relativeTime(lead.lastActivity ?? lead.contactedAt)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/marketing/leads/${lead.id}`}
                          className="text-slate-300 hover:text-[#1e3a5f] transition-colors text-sm font-medium"
                        >
                          →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Pág. {page + 1} de {totalPages} · {total.toLocaleString()} total
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pg = page < 3 ? i : page - 2 + i;
              if (pg >= totalPages) return null;
              return (
                <button
                  key={pg}
                  onClick={() => setPage(pg)}
                  className={cn("w-8 h-8 rounded-lg text-xs font-medium transition-colors", pg === page ? "bg-[#1e3a5f] text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50")}
                >
                  {pg + 1}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
