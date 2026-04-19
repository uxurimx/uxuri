"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Target, ArrowRight, X, Globe, MessageSquare, Mail, Instagram, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const NICHES = [
  "dentistas", "médicos", "abogados", "contadores", "arquitectos",
  "restaurantes", "cafeterías", "gimnasios", "estéticas", "spas",
  "hoteles", "veterinarias", "farmacias", "agencias inmobiliarias", "escuelas",
  "mecánicos", "ferreterías", "tiendas de ropa", "joyerías", "mueblerías",
];

const CHANNELS = [
  { value: "whatsapp",       label: "WhatsApp",         icon: MessageSquare, color: "bg-green-100 text-green-700" },
  { value: "email",          label: "Email",             icon: Mail,          color: "bg-blue-100 text-blue-700" },
  { value: "ig_dm",          label: "Instagram DM",      icon: Instagram,     color: "bg-pink-100 text-pink-700" },
  { value: "whatsapp_email", label: "WhatsApp + Email",  icon: MessageSquare, color: "bg-teal-100 text-teal-700" },
  { value: "sms",            label: "SMS",               icon: MessageSquare, color: "bg-amber-100 text-amber-700" },
  { value: "other",          label: "Otro",              icon: Globe,         color: "bg-slate-100 text-slate-600" },
] as const;

const STATUS_CONFIG = {
  draft:     { label: "Borrador",   className: "bg-slate-100 text-slate-600" },
  active:    { label: "Activa",     className: "bg-emerald-50 text-emerald-700" },
  paused:    { label: "Pausada",    className: "bg-amber-50 text-amber-700" },
  completed: { label: "Completada", className: "bg-blue-50 text-blue-700" },
} as const;

type Status = keyof typeof STATUS_CONFIG;
type Channel = typeof CHANNELS[number]["value"];

interface Strategy {
  id: string;
  title: string;
  description: string | null;
  productOffered: string | null;
  targetNiche: string | null;
  targetCity: string | null;
  targetCountry: string | null;
  channel: Channel;
  status: Status;
  notes: string | null;
  campaignCount: number;
  createdAt: string;
}

export function StrategiesList({ initialStrategies }: { initialStrategies: Strategy[] }) {
  const router = useRouter();
  const [strategies, setStrategies] = useState<Strategy[]>(initialStrategies);
  const [showModal, setShowModal] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [productOffered, setProductOffered] = useState("");
  const [targetNiche, setTargetNiche] = useState("");
  const [customNiche, setCustomNiche] = useState("");
  const [targetCity, setTargetCity] = useState("");
  const [targetCountry, setTargetCountry] = useState("México");
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [status, setStatus] = useState<Status>("active");
  const [notes, setNotes] = useState("");
  const [maxLeadsPerQuery, setMaxLeadsPerQuery] = useState<number>(50);
  const [scraperTimeoutMin, setScraperTimeoutMin] = useState<number>(30);

  function resetForm() {
    setTitle(""); setDescription(""); setProductOffered("");
    setTargetNiche(""); setCustomNiche(""); setTargetCity("");
    setTargetCountry("México"); setChannel("whatsapp"); setStatus("active"); setNotes("");
    setMaxLeadsPerQuery(50); setScraperTimeoutMin(30);
  }

  function openEdit(s: Strategy) {
    setEditingStrategy(s);
    setTitle(s.title);
    setDescription(s.description ?? "");
    setProductOffered(s.productOffered ?? "");
    const knownNiche = NICHES.includes(s.targetNiche ?? "");
    setTargetNiche(knownNiche ? (s.targetNiche ?? "") : s.targetNiche ? "__custom__" : "");
    setCustomNiche(knownNiche ? "" : (s.targetNiche ?? ""));
    setTargetCity(s.targetCity ?? "");
    setTargetCountry(s.targetCountry ?? "México");
    setChannel(s.channel);
    setStatus(s.status);
    setNotes(s.notes ?? "");
    setMaxLeadsPerQuery((s as Strategy & { maxLeadsPerQuery?: number }).maxLeadsPerQuery ?? 50);
    setScraperTimeoutMin((s as Strategy & { scraperTimeoutMin?: number }).scraperTimeoutMin ?? 30);
    setShowModal(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta estrategia? Esta acción no se puede deshacer.")) return;
    const res = await fetch(`/api/mkt/strategies/${id}`, { method: "DELETE" });
    if (res.ok) setStrategies((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      productOffered: productOffered.trim() || null,
      targetNiche: (targetNiche === "__custom__" ? customNiche : targetNiche) || null,
      targetCity: targetCity.trim() || null,
      targetCountry: targetCountry.trim() || null,
      channel,
      status,
      notes: notes.trim() || null,
      maxLeadsPerQuery,
      scraperTimeoutMin,
    };
    try {
      if (editingStrategy) {
        const res = await fetch(`/api/mkt/strategies/${editingStrategy.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const updated = await res.json();
          setStrategies((prev) => prev.map((s) =>
            s.id === editingStrategy.id ? { ...s, ...updated } : s
          ));
          setShowModal(false);
          setEditingStrategy(null);
          resetForm();
        }
      } else {
        const res = await fetch("/api/mkt/strategies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const s = await res.json();
          setStrategies((prev) => [{ ...s, campaignCount: 0 }, ...prev]);
          setShowModal(false);
          resetForm();
          router.push(`/marketing/strategies/${s.id}`);
        }
      }
    } finally {
      setSaving(false);
    }
  }

  const filtered = strategies.filter(
    (s) => statusFilter === "all" || s.status === statusFilter
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#1e3a5f]/10 flex items-center justify-center">
            <Target className="w-5 h-5 text-[#1e3a5f]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Estrategias</h1>
            <p className="text-sm text-slate-500">{strategies.length} estrategia(s)</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#162d4a] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva estrategia
        </button>
      </div>

      {/* Filters */}
      {strategies.length > 0 && (
        <div className="flex gap-2 overflow-x-auto mb-6 pb-1">
          {(["all", "active", "draft", "paused", "completed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "whitespace-nowrap px-3 py-1.5 text-sm font-medium rounded-full transition-colors",
                statusFilter === s
                  ? "bg-[#1e3a5f] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              {s === "all" ? "Todas" : STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {strategies.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay estrategias todavía.</p>
          <button onClick={() => setShowModal(true)} className="mt-3 text-[#1e3a5f] text-sm hover:underline">
            Crea la primera →
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">Sin estrategias con este estado.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((s) => {
            const ch = CHANNELS.find((c) => c.value === s.channel);
            const sc = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.draft;
            return (
              <div key={s.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:border-[#1e3a5f]/30 hover:shadow-sm transition-all group space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/marketing/strategies/${s.id}`} className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 line-clamp-2 group-hover:text-[#1e3a5f] transition-colors">
                      {s.title}
                    </h3>
                  </Link>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", sc.className)}>
                      {sc.label}
                    </span>
                    <button onClick={() => openEdit(s)} title="Editar" className="p-1 rounded hover:bg-slate-100 text-slate-300 hover:text-[#1e3a5f] transition-colors opacity-0 group-hover:opacity-100">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(s.id)} title="Eliminar" className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <Link href={`/marketing/strategies/${s.id}`} className="p-1 rounded opacity-0 group-hover:opacity-100">
                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                    </Link>
                  </div>
                </div>

                {s.productOffered && (
                  <p className="text-xs text-slate-500 font-medium bg-slate-50 px-2 py-1 rounded">
                    📦 {s.productOffered}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 text-xs">
                  {s.targetNiche && (
                    <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                      {s.targetNiche}
                    </span>
                  )}
                  {s.targetCity && (
                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                      📍 {s.targetCity}
                    </span>
                  )}
                  {ch && (
                    <span className={cn("px-2 py-0.5 rounded-full font-medium", ch.color)}>
                      {ch.label}
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-400 pt-1 border-t border-slate-100">
                  {s.campaignCount} campaña(s)
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Crear Estrategia */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">{editingStrategy ? "Editar estrategia" : "Nueva estrategia"}</h2>
              <button onClick={() => { setShowModal(false); setEditingStrategy(null); resetForm(); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Páginas web para dentistas CDMX"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Producto/Servicio ofrecido</label>
                <input
                  value={productOffered}
                  onChange={(e) => setProductOffered(e.target.value)}
                  placeholder="Ej: Página web profesional, Sistema CRM, App móvil"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nicho objetivo</label>
                  <select
                    value={targetNiche}
                    onChange={(e) => setTargetNiche(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] bg-white"
                  >
                    <option value="">Seleccionar...</option>
                    {NICHES.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                    <option value="__custom__">Otro (escribir)</option>
                  </select>
                  {targetNiche === "__custom__" && (
                    <input
                      value={customNiche}
                      onChange={(e) => setCustomNiche(e.target.value)}
                      placeholder="Escribe el nicho"
                      className="mt-2 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Ciudad</label>
                  <input
                    value={targetCity}
                    onChange={(e) => setTargetCity(e.target.value)}
                    placeholder="Ej: CDMX, Monterrey"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
                  />
                </div>
              </div>

              {/* ── Configuración de búsqueda ── */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Búsqueda en Google Maps</p>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Cantidad de leads a buscar
                    <span className="ml-1 text-slate-400 font-normal">(actual: {maxLeadsPerQuery})</span>
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {[5, 10, 25, 50, 100, 200].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setMaxLeadsPerQuery(n)}
                        className={cn(
                          "px-3 py-1 rounded-lg text-xs font-medium border transition-colors",
                          maxLeadsPerQuery === n
                            ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                            : "bg-white border-slate-200 text-slate-600 hover:border-slate-400"
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={maxLeadsPerQuery}
                    onChange={(e) => setMaxLeadsPerQuery(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-24 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Tiempo límite de búsqueda
                    <span className="ml-1 text-slate-400 font-normal">(minutos)</span>
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {[10, 20, 30, 60, 90].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setScraperTimeoutMin(n)}
                        className={cn(
                          "px-3 py-1 rounded-lg text-xs font-medium border transition-colors",
                          scraperTimeoutMin === n
                            ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                            : "bg-white border-slate-200 text-slate-600 hover:border-slate-400"
                        )}
                      >
                        {n} min
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={scraperTimeoutMin}
                    onChange={(e) => setScraperTimeoutMin(Math.max(5, parseInt(e.target.value) || 5))}
                    className="w-24 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Canal</label>
                <div className="grid grid-cols-3 gap-2">
                  {CHANNELS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setChannel(c.value)}
                      className={cn(
                        "px-3 py-2 rounded-lg text-xs font-medium border transition-colors",
                        channel === c.value
                          ? "border-[#1e3a5f] bg-[#1e3a5f]/5 text-[#1e3a5f]"
                          : "border-slate-200 text-slate-500 hover:border-slate-300"
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Estado inicial</label>
                <div className="flex gap-2">
                  {(["active", "draft"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                        status === s
                          ? "border-[#1e3a5f] bg-[#1e3a5f]/5 text-[#1e3a5f]"
                          : "border-slate-200 text-slate-500 hover:border-slate-300"
                      )}
                    >
                      {STATUS_CONFIG[s].label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Descripción / notas</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Objetivo de la estrategia, audiencia ideal, etc."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !title.trim()}
                  className="flex-1 px-4 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#162d4a] disabled:opacity-50 transition-colors"
                >
                  {saving ? "Guardando..." : editingStrategy ? "Guardar cambios" : "Crear estrategia"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
