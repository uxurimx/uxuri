"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { CheckSquare, Square, CheckCheck, Send, MessageSquare, Filter, RefreshCw, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CampaignLead {
  id: string;
  name: string | null;
  phone: string | null;
  city: string | null;
  niche: string | null;
  status: string;
  score: number | null;
  hasWhatsapp: number | null;
  approvedForSend: number;
  socialData: unknown;
  contactedAt: string | null;
}

interface Props {
  campaignId: string;
  campaignStatus: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SCORE_COLOR = (s: number | null) => {
  if (!s) return "bg-slate-100 text-slate-400";
  if (s >= 8) return "bg-emerald-100 text-emerald-700";
  if (s >= 5) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-600";
};

const STATUS_BADGE: Record<string, string> = {
  nuevo:        "bg-blue-100 text-blue-700",
  pendiente:    "bg-cyan-100 text-cyan-700",
  contactado:   "bg-yellow-100 text-yellow-700",
  interesado:   "bg-emerald-100 text-emerald-700",
  no_responde:  "bg-slate-100 text-slate-500",
  sin_whatsapp: "bg-orange-100 text-orange-700",
  descartado:   "bg-red-100 text-red-600",
  cerrado:      "bg-purple-100 text-purple-700",
};

const STATUS_LABEL: Record<string, string> = {
  nuevo: "Nuevo", pendiente: "Pendiente", contactado: "Contactado",
  interesado: "Interesado", no_responde: "Sin respuesta",
  sin_whatsapp: "Sin WA", descartado: "Descartado", cerrado: "Cerrado",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function CampaignLeads({ campaignId, campaignStatus }: Props) {
  const [leads, setLeads] = useState<CampaignLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterApproved, setFilterApproved] = useState<"all" | "approved" | "pending">("all");
  const [filterWa, setFilterWa] = useState<"all" | "yes" | "no">("all");
  const [minScore, setMinScore] = useState<number>(0);
  const [approving, setApproving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ campaignId, limit: "200" });
      if (filterApproved === "approved") params.set("approvedForSend", "1");
      if (filterApproved === "pending")  params.set("approvedForSend", "0");
      if (filterWa === "yes") params.set("hasWhatsapp", "yes");
      if (filterWa === "no")  params.set("hasWhatsapp", "no");
      const res = await fetch(`/api/mkt/leads?${params}`);
      if (!res.ok) throw new Error("Error cargando leads");
      const data = await res.json();
      const rows: CampaignLead[] = Array.isArray(data) ? data : (data.rows ?? []);
      setLeads(minScore > 0 ? rows.filter((l) => (l.score ?? 0) >= minScore) : rows);
    } finally {
      setLoading(false);
    }
  }, [campaignId, filterApproved, filterWa, minScore]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // Selection helpers
  const toggleAll = () => {
    if (selected.size === leads.length) setSelected(new Set());
    else setSelected(new Set(leads.map((l) => l.id)));
  };
  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Bulk approve/disapprove
  const handleApprove = async (approve: boolean) => {
    setApproving(true);
    try {
      const body: Record<string, unknown> = { approve };
      if (selected.size > 0 && selected.size < leads.length) {
        body.leadIds = Array.from(selected);
      }
      if (minScore > 0 && selected.size === 0) body.minScore = minScore;
      const res = await fetch(`/api/mkt/campaigns/${campaignId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Error al aprobar");
      const { updated } = await res.json();
      setSelected(new Set());
      await fetchLeads();
      alert(`${updated} leads ${approve ? "aprobados" : "desaprobados"}`);
    } catch (e) {
      alert(String(e));
    } finally {
      setApproving(false);
    }
  };

  // Send single WA
  const handleSendWa = async (lead: CampaignLead) => {
    if (!confirm(`Enviar WhatsApp a ${lead.name ?? lead.phone}?`)) return;
    setSendingId(lead.id);
    try {
      const res = await fetch(`/api/mkt/leads/${lead.id}/send-wa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) { alert(`Error: ${data.error}`); return; }
      alert(`Job iniciado: ${data.jobId}`);
    } catch (e) {
      alert(String(e));
    } finally {
      setSendingId(null);
    }
  };

  const canSend = ["ready", "running", "completed"].includes(campaignStatus);
  const approvedCount = leads.filter((l) => l.approvedForSend === 1).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-800">Leads de la campaña</h3>
            {!loading && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {leads.length} leads · {approvedCount} aprobados
              </span>
            )}
          </div>
          <button onClick={fetchLeads} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mt-3">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3 h-3 text-slate-400" />
            <span className="text-xs text-slate-500">Filtros:</span>
          </div>

          {/* Approved filter */}
          {(["all", "approved", "pending"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setFilterApproved(v)}
              className={cn(
                "text-xs px-2 py-1 rounded-full border transition-colors",
                filterApproved === v
                  ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
              )}
            >
              {v === "all" ? "Todos" : v === "approved" ? "Aprobados" : "Sin aprobar"}
            </button>
          ))}

          {/* WA filter */}
          {(["all", "yes", "no"] as const).map((v) => (
            <button
              key={`wa-${v}`}
              onClick={() => setFilterWa(v)}
              className={cn(
                "text-xs px-2 py-1 rounded-full border transition-colors",
                filterWa === v
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
              )}
            >
              {v === "all" ? "Todo WA" : v === "yes" ? "Con WA" : "Sin WA"}
            </button>
          ))}

          {/* Min score */}
          <select
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="text-xs px-2 py-1 rounded-full border border-slate-200 bg-white text-slate-600 focus:outline-none"
          >
            <option value={0}>Score mín: todos</option>
            {[5, 6, 7, 8, 9].map((s) => (
              <option key={s} value={s}>Score ≥ {s}</option>
            ))}
          </select>
        </div>

        {/* Bulk actions */}
        {leads.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100">
            <span className="text-xs text-slate-500">
              {selected.size > 0 ? `${selected.size} seleccionados` : ""}
            </span>
            <button
              onClick={() => handleApprove(true)}
              disabled={approving}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium transition-colors disabled:opacity-50"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              {selected.size > 0 ? `Aprobar ${selected.size}` : "Aprobar todos"}
            </button>
            <button
              onClick={() => handleApprove(false)}
              disabled={approving}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 font-medium transition-colors disabled:opacity-50"
            >
              Desaprobar {selected.size > 0 ? selected.size : "todos"}
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-12 text-center text-sm text-slate-400">Cargando leads…</div>
      ) : leads.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-400">
          Sin leads con los filtros actuales.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                <th className="pl-4 pr-2 py-2 w-8">
                  <button onClick={toggleAll}>
                    {selected.size === leads.length && leads.length > 0
                      ? <CheckSquare className="w-4 h-4 text-[#1e3a5f]" />
                      : <Square className="w-4 h-4 text-slate-300" />}
                  </button>
                </th>
                <th className="px-3 py-2 font-medium">Nombre</th>
                <th className="px-3 py-2 font-medium">Teléfono</th>
                <th className="px-3 py-2 font-medium">Ciudad</th>
                <th className="px-3 py-2 font-medium">Score</th>
                <th className="px-3 py-2 font-medium">WA</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium">Enriq.</th>
                <th className="px-3 py-2 font-medium">Aprobado</th>
                {canSend && <th className="px-3 py-2 font-medium">Enviar</th>}
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr
                  key={lead.id}
                  className={cn(
                    "border-b border-slate-50 hover:bg-slate-50/60 transition-colors",
                    selected.has(lead.id) && "bg-blue-50/40"
                  )}
                >
                  <td className="pl-4 pr-2 py-2.5">
                    <button onClick={() => toggle(lead.id)}>
                      {selected.has(lead.id)
                        ? <CheckSquare className="w-4 h-4 text-[#1e3a5f]" />
                        : <Square className="w-4 h-4 text-slate-300" />}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 max-w-[160px]">
                    <span className="font-medium text-slate-800 truncate block">{lead.name ?? "—"}</span>
                    {lead.niche && <span className="text-xs text-slate-400">{lead.niche}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600 tabular-nums">{lead.phone ?? "—"}</td>
                  <td className="px-3 py-2.5 text-slate-500 text-xs">{lead.city ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded", SCORE_COLOR(lead.score))}>
                      {lead.score ?? "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {lead.hasWhatsapp === 1
                      ? <span className="text-emerald-500 text-base">✓</span>
                      : lead.hasWhatsapp === 0
                        ? <span className="text-red-400 text-base">✗</span>
                        : <span className="text-slate-300 text-xs">?</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={cn("text-xs px-1.5 py-0.5 rounded-full", STATUS_BADGE[lead.status] ?? "bg-slate-100 text-slate-500")}>
                      {STATUS_LABEL[lead.status] ?? lead.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {lead.socialData
                      ? <span className="text-purple-500 text-xs font-medium">✓</span>
                      : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {lead.approvedForSend === 1
                      ? <span className="text-emerald-600 text-xs font-bold">✓</span>
                      : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  {canSend && (
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => handleSendWa(lead)}
                        disabled={sendingId === lead.id || !lead.phone}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-[#25d366] hover:bg-green-50 transition-colors disabled:opacity-30"
                        title="Enviar WhatsApp"
                      >
                        {sendingId === lead.id
                          ? <MessageSquare className="w-3.5 h-3.5 animate-pulse" />
                          : <Send className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                  )}
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/marketing/leads/${lead.id}`}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-[#1e3a5f] hover:bg-slate-100 transition-colors block"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
