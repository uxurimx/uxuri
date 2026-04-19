"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, X, Zap, ArrowRight, Play, Pause, CheckCircle2, Clock, AlertCircle, Loader2, Search, Pencil, Trash2, Sparkles, Brain, CalendarClock, Send, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { CampaignProgress } from "./campaign-progress";

const STATUS_CONFIG = {
  draft:      { label: "Borrador",       icon: Clock,         color: "bg-slate-100 text-slate-600" },
  scraping:   { label: "Buscando leads", icon: Search,        color: "bg-cyan-50 text-cyan-700" },
  enriching:  { label: "Enriqueciendo",  icon: Sparkles,      color: "bg-purple-50 text-purple-700" },
  ready:      { label: "Lista",          icon: CheckCircle2,  color: "bg-emerald-50 text-emerald-700" },
  scheduled:  { label: "Programada",     icon: CalendarClock, color: "bg-indigo-50 text-indigo-700" },
  queued:     { label: "En cola",        icon: Clock,         color: "bg-amber-50 text-amber-700" },
  claimed:    { label: "Tomada",         icon: Loader2,       color: "bg-orange-50 text-orange-700" },
  running:    { label: "Enviando",       icon: Play,          color: "bg-emerald-50 text-emerald-700" },
  completed:  { label: "Completada",     icon: CheckCircle2,  color: "bg-blue-50 text-blue-700" },
  paused:     { label: "Pausada",        icon: Pause,         color: "bg-slate-100 text-slate-600" },
  failed:     { label: "Fallida",        icon: AlertCircle,   color: "bg-red-50 text-red-700" },
} as const;

type CampaignStatus = keyof typeof STATUS_CONFIG;

interface StrategyOption { id: string; title: string; targetNiche: string | null; targetCity: string | null; }
interface CopyOption { id: string; title: string; type: string; abVariant: string | null; }
interface WorkerOption { id: string; name: string | null; }

interface Campaign {
  id: string;
  title: string;
  status: CampaignStatus;
  totalLeads: number;
  contacted: number;
  responded: number;
  interested: number;
  converted: number;
  scheduledAt: string | null;
  notes: string | null;
  strategy: StrategyOption | null;
  copy: CopyOption | null;
  worker: WorkerOption | null;
  createdAt: string;
}

interface CampaignsListProps {
  initialCampaigns: Campaign[];
  strategies: StrategyOption[];
  copies: CopyOption[];
  workers: WorkerOption[];
}

export function CampaignsList({ initialCampaigns, strategies, copies, workers }: CampaignsListProps) {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
  const [showModal, setShowModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | CampaignStatus>("all");
  const [saving, setSaving] = useState(false);
  const [scheduleModal, setScheduleModal] = useState<string | null>(null); // campaignId
  const [scheduleDate, setScheduleDate] = useState("");

  // Form
  const [title, setTitle] = useState("");
  const [strategyId, setStrategyId] = useState("");
  const [copyId, setCopyId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [status, setStatus] = useState<CampaignStatus>("draft");
  const [notes, setNotes] = useState("");

  function resetForm() {
    setTitle(""); setStrategyId(""); setCopyId(""); setAssignedTo("");
    setScheduledAt(""); setStatus("draft"); setNotes("");
  }

  function openEdit(c: Campaign) {
    setEditingCampaign(c);
    setTitle(c.title);
    setStrategyId(c.strategy?.id ?? "");
    setCopyId(c.copy?.id ?? "");
    setAssignedTo(c.worker?.id ?? "");
    setScheduledAt(c.scheduledAt ? new Date(c.scheduledAt).toISOString().slice(0, 16) : "");
    setStatus(c.status);
    setNotes(c.notes ?? "");
    setShowModal(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta campaña? Esta acción no se puede deshacer.")) return;
    const res = await fetch(`/api/mkt/campaigns/${id}`, { method: "DELETE" });
    if (res.ok) setCampaigns((prev) => prev.filter((c) => c.id !== id));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const payload = {
      title: title.trim(),
      strategyId: strategyId || null,
      copyId: copyId || null,
      assignedTo: assignedTo || null,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      status,
      notes: notes.trim() || null,
    };
    try {
      if (editingCampaign) {
        const res = await fetch(`/api/mkt/campaigns/${editingCampaign.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const updated = await res.json();
          const strategy = strategies.find((s) => s.id === strategyId) ?? null;
          const copy = copies.find((cp) => cp.id === copyId) ?? null;
          const worker = workers.find((w) => w.id === assignedTo) ?? null;
          setCampaigns((prev) => prev.map((c) =>
            c.id === editingCampaign.id ? { ...c, ...updated, strategy, copy, worker } : c
          ));
          setShowModal(false);
          setEditingCampaign(null);
          resetForm();
        }
      } else {
        const res = await fetch("/api/mkt/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const c = await res.json();
          const strategy = strategies.find((s) => s.id === strategyId) ?? null;
          const copy = copies.find((cp) => cp.id === copyId) ?? null;
          const worker = workers.find((w) => w.id === assignedTo) ?? null;
          setCampaigns((prev) => [
            { ...c, strategy, copy, worker, totalLeads: 0, contacted: 0, responded: 0, interested: 0, converted: 0 },
            ...prev,
          ]);
          setShowModal(false);
          resetForm();
          router.push(`/marketing/campaigns/${c.id}`);
        }
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(id: string, newStatus: CampaignStatus) {
    const res = await fetch(`/api/mkt/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setCampaigns((prev) => prev.map((c) => c.id === id ? { ...c, status: newStatus } : c));
    }
  }

  async function handleScrape(id: string) {
    const res = await fetch(`/api/mkt/campaigns/${id}/scrape`, { method: "POST" });
    if (res.ok) {
      setCampaigns((prev) => prev.map((c) => c.id === id ? { ...c, status: "scraping" } : c));
    }
  }

  async function handleLaunch(id: string) {
    const res = await fetch(`/api/mkt/campaigns/${id}/launch`, { method: "POST" });
    if (res.ok) {
      setCampaigns((prev) => prev.map((c) => c.id === id ? { ...c, status: "queued" } : c));
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "No se puede enviar en este momento");
    }
  }

  async function handleSchedule(id: string) {
    if (!scheduleDate) return;
    const res = await fetch(`/api/mkt/campaigns/${id}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledAt: new Date(scheduleDate).toISOString() }),
    });
    if (res.ok) {
      setCampaigns((prev) => prev.map((c) =>
        c.id === id ? { ...c, status: "scheduled", scheduledAt: new Date(scheduleDate).toISOString() } : c
      ));
      setScheduleModal(null);
      setScheduleDate("");
    }
  }

  async function handleCancelSchedule(id: string) {
    const res = await fetch(`/api/mkt/campaigns/${id}/schedule`, { method: "DELETE" });
    if (res.ok) {
      setCampaigns((prev) => prev.map((c) =>
        c.id === id ? { ...c, status: "ready", scheduledAt: null } : c
      ));
    }
  }

  async function handleEnrich(id: string) {
    await fetch(`/api/mkt/campaigns/${id}/enrich`, { method: "POST" });
  }

  async function handleAiCopy(id: string, framework = "AIDA") {
    await fetch(`/api/mkt/campaigns/${id}/ai-copy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ framework, variants: 2 }),
    });
  }

  const filtered = campaigns.filter(
    (c) => statusFilter === "all" || c.status === statusFilter
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#1e3a5f]/10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-[#1e3a5f]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Campañas</h1>
            <p className="text-sm text-slate-500">{campaigns.length} campaña(s)</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#162d4a] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva campaña
        </button>
      </div>

      {/* Filters */}
      {campaigns.length > 0 && (
        <div className="flex gap-2 overflow-x-auto mb-6 pb-1">
          <button onClick={() => setStatusFilter("all")} className={cn("whitespace-nowrap px-3 py-1.5 text-sm font-medium rounded-full", statusFilter === "all" ? "bg-[#1e3a5f] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>Todas</button>
          {(["draft", "scraping", "ready", "scheduled", "running", "queued", "completed", "paused", "failed"] as const).map((s) => {
            const sc = STATUS_CONFIG[s];
            const StatusIcon = sc.icon;
            return (
              <button key={s} onClick={() => setStatusFilter(s)} className={cn("whitespace-nowrap px-3 py-1.5 text-sm font-medium rounded-full flex items-center gap-1", statusFilter === s ? "bg-[#1e3a5f] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
                <StatusIcon className="w-3 h-3" />
                {sc.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Empty */}
      {campaigns.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Zap className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay campañas todavía.</p>
          <button onClick={() => setShowModal(true)} className="mt-3 text-[#1e3a5f] text-sm hover:underline">Crea la primera →</button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => {
            const sc = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.draft;
            const StatusIcon = sc.icon;
            const respRate = c.contacted > 0 ? Math.round((c.responded / c.contacted) * 100) : 0;
            const convRate = c.contacted > 0 ? Math.round((c.converted / c.contacted) * 100) : 0;
            return (
              <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-all group">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Link href={`/marketing/campaigns/${c.id}`} className="font-semibold text-slate-900 hover:text-[#1e3a5f] transition-colors line-clamp-1">
                        {c.title}
                      </Link>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 shrink-0", sc.color)}>
                        <StatusIcon className="w-3 h-3" />
                        {sc.label}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs mb-3">
                      {c.strategy && (
                        <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                          📍 {c.strategy.targetNiche ?? "—"}{c.strategy.targetCity ? ` · ${c.strategy.targetCity}` : ""}
                        </span>
                      )}
                      {c.copy && (
                        <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">
                          ✉️ {c.copy.title}{c.copy.abVariant ? ` (${c.copy.abVariant})` : ""}
                        </span>
                      )}
                      {c.worker && (
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                          👤 {c.worker.name ?? "Worker"}
                        </span>
                      )}
                      {c.scheduledAt && (
                        <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                          🕐 {new Date(c.scheduledAt).toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>

                    {/* Métricas compactas */}
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-slate-500">{c.totalLeads.toLocaleString()} leads</span>
                      <span className="text-yellow-600 font-medium">{c.contacted.toLocaleString()} contactados</span>
                      <span className="text-blue-600 font-medium">{respRate}% respondieron</span>
                      <span className="text-emerald-600 font-medium">{c.converted.toLocaleString()} convertidos ({convRate}%)</span>
                    </div>
                  </div>

                  {/* Acciones rápidas */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">

                    {/* FASE 1: Buscar leads */}
                    {(c.status === "draft" || c.status === "failed" || c.status === "paused") && (
                      <button onClick={() => handleScrape(c.id)} title="Buscar leads en Google Maps" className="p-1.5 rounded-lg hover:bg-cyan-50 text-slate-400 hover:text-cyan-600 transition-colors">
                        <Search className="w-4 h-4" />
                      </button>
                    )}

                    {/* FASE 3+4: Enriquecer y AI copy (cuando hay leads) */}
                    {(c.status === "ready" || c.status === "completed" || c.status === "paused") && (
                      <>
                        <button onClick={() => handleEnrich(c.id)} title="Enriquecer leads (IG/FB/reseñas)" className="p-1.5 rounded-lg hover:bg-purple-50 text-slate-400 hover:text-purple-600 transition-colors">
                          <Sparkles className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleAiCopy(c.id)} title="Generar AI copy (AIDA)" className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors">
                          <Brain className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {/* FASE 2: Enviar ahora o programar (solo desde ready) */}
                    {c.status === "ready" && (
                      <>
                        <button onClick={() => handleLaunch(c.id)} title="Enviar ahora" className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors">
                          <Send className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setScheduleModal(c.id); setScheduleDate(""); }} title="Programar envío" className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors">
                          <CalendarClock className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {/* Cancelar programación */}
                    {c.status === "scheduled" && (
                      <button onClick={() => handleCancelSchedule(c.id)} title="Cancelar envío programado" className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}

                    {/* Detener (mientras corre) */}
                    {(c.status === "running" || c.status === "scraping") && (
                      <button onClick={() => handleStatusChange(c.id, "paused")} title="Pausar" className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors">
                        <Pause className="w-4 h-4" />
                      </button>
                    )}

                    <button onClick={() => openEdit(c)} title="Editar" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-[#1e3a5f] transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(c.id)} title="Eliminar" className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <Link href={`/marketing/campaigns/${c.id}`} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
                {/* Progress en tiempo real — fuera del flex, ocupa todo el ancho */}
                {(c.status === "scraping" || c.status === "running" ||
                  c.status === "claimed" || c.status === "queued") && (
                  <CampaignProgress
                    campaignId={c.id}
                    initialStatus={c.status}
                    initialContacted={c.contacted}
                    initialTotal={c.totalLeads}
                    onStatusChange={(s) =>
                      setCampaigns((prev) =>
                        prev.map((x) => x.id === c.id ? { ...x, status: s as CampaignStatus } : x)
                      )
                    }
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Crear Campaña */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">{editingCampaign ? "Editar campaña" : "Nueva campaña"}</h2>
              <button onClick={() => { setShowModal(false); setEditingCampaign(null); resetForm(); }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Dentistas CDMX — Lunes — Copy A" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]" required />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Estrategia</label>
                <select value={strategyId} onChange={(e) => setStrategyId(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white">
                  <option value="">Sin estrategia</option>
                  {strategies.map((s) => (
                    <option key={s.id} value={s.id}>{s.title}{s.targetNiche ? ` — ${s.targetNiche}` : ""}{s.targetCity ? `, ${s.targetCity}` : ""}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Copy asignado</label>
                <select value={copyId} onChange={(e) => setCopyId(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white">
                  <option value="">Sin copy</option>
                  {copies.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}{c.abVariant ? ` (Var. ${c.abVariant})` : ""} — {c.type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Worker asignado</label>
                <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white">
                  <option value="">Sin asignar</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>{w.name ?? w.id}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Fecha/hora programada (opcional)</label>
                <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]" />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Estado inicial</label>
                <div className="flex gap-2 flex-wrap">
                  {(["draft", "queued"] as const).map((s) => (
                    <button key={s} type="button" onClick={() => setStatus(s)}
                      className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                        status === s ? "border-[#1e3a5f] bg-[#1e3a5f]/5 text-[#1e3a5f]" : "border-slate-200 text-slate-500 hover:border-slate-300"
                      )}>
                      {STATUS_CONFIG[s].label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notas</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Objetivo, segmento específico, instrucciones para el worker..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors">Cancelar</button>
                <button type="submit" disabled={saving || !title.trim()} className="flex-1 px-4 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#162d4a] disabled:opacity-50 transition-colors">
                  {saving ? "Guardando..." : editingCampaign ? "Guardar cambios" : "Crear campaña"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Programar envío */}
      {scheduleModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
              <div>
                <h2 className="font-semibold text-slate-900">Programar envío</h2>
                <p className="text-xs text-slate-400 mt-0.5">El sistema enviará automáticamente a la hora indicada</p>
              </div>
              <button onClick={() => setScheduleModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Fecha y hora de envío</label>
                <input
                  type="datetime-local"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setScheduleModal(null)} className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={() => handleSchedule(scheduleModal)}
                  disabled={!scheduleDate}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                >
                  Programar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
