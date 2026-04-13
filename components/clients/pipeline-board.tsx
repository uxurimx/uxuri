"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  MessageCircle, UserCheck, Sparkles, FileText, Handshake,
  Users, RefreshCw, XCircle, Plus, Phone, Mail, Globe,
  Building2, ChevronDown, ExternalLink
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type PipelineStage =
  | "contacto" | "lead" | "prospecto" | "propuesta"
  | "negociacion" | "cliente" | "recurrente" | "churned";

type PipelineClient = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: string;
  pipelineStage: PipelineStage | null;
  sourceBusinessId: string | null;
  sourceChannel: string | null;
  firstContactDate: string | null;
  estimatedValue: string | null;
  notes: string | null;
  createdAt: Date | string;
  sourceBizName: string | null;
  sourceBizLogo: string | null;
};

type Business = { id: string; name: string; logo: string | null };

// ─── Config ───────────────────────────────────────────────────────────────────

const STAGE_CONFIG: Record<PipelineStage, {
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  description: string;
}> = {
  contacto:     { label: "Contacto",     icon: MessageCircle, color: "text-slate-600", bg: "bg-slate-50",    border: "border-slate-200", description: "Primer mensaje / señal" },
  lead:         { label: "Lead",          icon: UserCheck,     color: "text-blue-600",  bg: "bg-blue-50",     border: "border-blue-200",  description: "Datos capturados" },
  prospecto:    { label: "Prospecto",     icon: Sparkles,      color: "text-violet-600",bg: "bg-violet-50",   border: "border-violet-200",description: "Interés confirmado" },
  propuesta:    { label: "Propuesta",     icon: FileText,      color: "text-amber-600", bg: "bg-amber-50",    border: "border-amber-200", description: "Propuesta enviada" },
  negociacion:  { label: "Negociación",   icon: Handshake,     color: "text-orange-600",bg: "bg-orange-50",   border: "border-orange-200",description: "Negociando términos" },
  cliente:      { label: "Cliente",       icon: Users,         color: "text-emerald-600",bg: "bg-emerald-50", border: "border-emerald-200",description: "Cerrado ✓" },
  recurrente:   { label: "Recurrente",    icon: RefreshCw,     color: "text-teal-600",  bg: "bg-teal-50",     border: "border-teal-200",  description: "Proyectos repetidos" },
  churned:      { label: "Inactivo",      icon: XCircle,       color: "text-red-400",   bg: "bg-red-50",      border: "border-red-200",   description: "Se fue / canceló" },
};

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp", instagram: "Instagram", facebook: "Facebook",
  referral: "Referido", web: "Web", directo: "Directo", email: "Email", otro: "Otro",
};

const VISIBLE_STAGES: PipelineStage[] = [
  "contacto", "lead", "prospecto", "propuesta", "negociacion", "cliente", "recurrente",
];

function fmt(v: string | null) {
  if (!v) return null;
  const n = parseFloat(v);
  return "$" + n.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ─── Quick Add Modal ──────────────────────────────────────────────────────────

function QuickAddModal({ businesses, onAdded, onClose }: {
  businesses: Business[];
  onAdded: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    company: "",
    sourceBusinessId: "",
    sourceChannel: "whatsapp",
    pipelineStage: "contacto" as PipelineStage,
    estimatedValue: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        phone: form.phone || undefined,
        email: form.email || undefined,
        company: form.company || undefined,
        sourceBusinessId: form.sourceBusinessId || undefined,
        sourceChannel: form.sourceChannel,
        pipelineStage: form.pipelineStage,
        estimatedValue: form.estimatedValue || undefined,
        notes: form.notes || undefined,
        firstContactDate: new Date().toISOString().split("T")[0],
        status: "prospect",
      }),
    });
    setSaving(false);
    onAdded();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="p-5 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900 text-lg">Nuevo contacto</h2>
          <p className="text-sm text-slate-500 mt-0.5">Captura rápida de lead / prospecto</p>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          {/* Nombre */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Nombre *</label>
            <input
              autoFocus
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nombre del contacto o empresa"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">WhatsApp / Teléfono</label>
              <input
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="+52 55..."
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Email</label>
              <input
                type="email"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="correo@ejemplo.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Negocio origen */}
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Entró por</label>
              <select
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={form.sourceBusinessId}
                onChange={e => setForm(f => ({ ...f, sourceBusinessId: e.target.value }))}
              >
                <option value="">— Sin negocio —</option>
                {businesses.map(b => (
                  <option key={b.id} value={b.id}>{b.logo} {b.name}</option>
                ))}
              </select>
            </div>
            {/* Canal */}
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Canal</label>
              <select
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={form.sourceChannel}
                onChange={e => setForm(f => ({ ...f, sourceChannel: e.target.value }))}
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
                <option value="web">Web</option>
                <option value="referral">Referido</option>
                <option value="directo">Directo</option>
                <option value="email">Email</option>
                <option value="otro">Otro</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Stage inicial */}
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Etapa inicial</label>
              <select
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={form.pipelineStage}
                onChange={e => setForm(f => ({ ...f, pipelineStage: e.target.value as PipelineStage }))}
              >
                {VISIBLE_STAGES.map(s => (
                  <option key={s} value={s}>{STAGE_CONFIG[s].label}</option>
                ))}
              </select>
            </div>
            {/* Valor estimado */}
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Valor estimado (MXN)</label>
              <input
                type="text"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
                value={form.estimatedValue}
                onChange={e => setForm(f => ({ ...f, estimatedValue: e.target.value }))}
              />
            </div>
          </div>

          <textarea
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={2}
            placeholder="Notas (opcional)"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          />

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !form.name.trim()}
              className="flex-1 py-2.5 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {saving ? "Guardando..." : "Agregar contacto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Client Card ──────────────────────────────────────────────────────────────

function ClientCard({ client, onMove }: {
  client: PipelineClient;
  onMove: (id: string, stage: PipelineStage) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm hover:shadow-md hover:border-slate-200 transition-all cursor-default group">
      {/* Name + link */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <Link
          href={`/clients/${client.id}`}
          className="text-sm font-semibold text-slate-800 hover:text-blue-600 leading-tight line-clamp-2"
        >
          {client.name}
        </Link>
        <Link
          href={`/clients/${client.id}`}
          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-600 transition-opacity shrink-0"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Company */}
      {client.company && (
        <p className="text-xs text-slate-500 flex items-center gap-1 mb-1.5">
          <Building2 className="w-3 h-3" /> {client.company}
        </p>
      )}

      {/* Contact info */}
      <div className="flex flex-wrap gap-2 mb-2.5">
        {client.phone && (
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Phone className="w-3 h-3" /> {client.phone}
          </span>
        )}
        {client.email && (
          <span className="text-xs text-slate-400 flex items-center gap-1 truncate max-w-[120px]">
            <Mail className="w-3 h-3" /> {client.email}
          </span>
        )}
      </div>

      {/* Source + channel badges */}
      <div className="flex flex-wrap gap-1 mb-2.5">
        {client.sourceBizName && (
          <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded border border-blue-100 font-medium">
            {client.sourceBizLogo} {client.sourceBizName}
          </span>
        )}
        {client.sourceChannel && (
          <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">
            {CHANNEL_LABEL[client.sourceChannel] ?? client.sourceChannel}
          </span>
        )}
      </div>

      {/* Estimated value */}
      {client.estimatedValue && (
        <div className="text-sm font-bold text-emerald-600 mb-2">
          {fmt(client.estimatedValue)}
        </div>
      )}

      {/* Move button */}
      <div className="relative">
        <button
          onClick={() => setShowMenu(v => !v)}
          className="w-full flex items-center justify-between px-2 py-1.5 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <span>Mover a...</span>
          <ChevronDown className="w-3 h-3" />
        </button>
        {showMenu && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 overflow-hidden">
            {VISIBLE_STAGES.map(stage => {
              const cfg = STAGE_CONFIG[stage];
              const Icon = cfg.icon;
              return (
                <button
                  key={stage}
                  onClick={() => { onMove(client.id, stage); setShowMenu(false); }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-slate-50 transition-colors text-left",
                    client.pipelineStage === stage ? "bg-slate-50 font-semibold" : ""
                  )}
                >
                  <Icon className={cn("w-3.5 h-3.5", cfg.color)} />
                  {cfg.label}
                </button>
              );
            })}
            <div className="border-t border-slate-100 mt-1 pt-1">
              <button
                onClick={() => { onMove(client.id, "churned"); setShowMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors text-left"
              >
                <XCircle className="w-3.5 h-3.5" /> Inactivo / Churn
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Stage Column ─────────────────────────────────────────────────────────────

function StageColumn({ stage, clients, onMove }: {
  stage: PipelineStage;
  clients: PipelineClient[];
  onMove: (id: string, stage: PipelineStage) => void;
}) {
  const cfg = STAGE_CONFIG[stage];
  const Icon = cfg.icon;
  const totalValue = clients.reduce((s, c) => s + (c.estimatedValue ? parseFloat(c.estimatedValue) : 0), 0);

  return (
    <div className="flex flex-col min-w-[220px] max-w-[260px] flex-shrink-0">
      {/* Column header */}
      <div className={cn("rounded-xl border p-3 mb-3", cfg.bg, cfg.border)}>
        <div className="flex items-center gap-2 mb-0.5">
          <Icon className={cn("w-4 h-4", cfg.color)} />
          <span className={cn("text-sm font-semibold", cfg.color)}>{cfg.label}</span>
          <span className={cn("ml-auto text-xs font-bold px-1.5 py-0.5 rounded-full", cfg.bg, cfg.color)}>
            {clients.length}
          </span>
        </div>
        <p className="text-xs text-slate-400">{cfg.description}</p>
        {totalValue > 0 && (
          <p className={cn("text-xs font-semibold mt-1", cfg.color)}>
            ${totalValue.toLocaleString("es-MX", { minimumFractionDigits: 0 })} estimado
          </p>
        )}
      </div>

      {/* Cards */}
      <div className="space-y-2 flex-1">
        {clients.map(c => (
          <ClientCard key={c.id} client={c} onMove={onMove} />
        ))}
        {clients.length === 0 && (
          <div className="text-center text-xs text-slate-300 py-6 border-2 border-dashed border-slate-100 rounded-xl">
            Sin contactos
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Pipeline Stats Bar ───────────────────────────────────────────────────────

function PipelineStats({ clients }: { clients: PipelineClient[] }) {
  const totalValue = clients.reduce((s, c) => s + (c.estimatedValue ? parseFloat(c.estimatedValue) : 0), 0);
  const clientCount = clients.filter(c => c.pipelineStage === "cliente" || c.pipelineStage === "recurrente").length;
  const activeLeads = clients.filter(c => c.pipelineStage && !["cliente", "recurrente", "churned"].includes(c.pipelineStage)).length;

  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      <div className="bg-white border border-slate-100 rounded-xl p-4">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">Valor pipeline</p>
        <p className="text-xl font-bold text-slate-800">
          ${totalValue.toLocaleString("es-MX", { minimumFractionDigits: 0 })}
        </p>
      </div>
      <div className="bg-white border border-slate-100 rounded-xl p-4">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">Leads activos</p>
        <p className="text-xl font-bold text-blue-600">{activeLeads}</p>
      </div>
      <div className="bg-white border border-slate-100 rounded-xl p-4">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">Clientes cerrados</p>
        <p className="text-xl font-bold text-emerald-600">{clientCount}</p>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function PipelineBoard({ clients: initialClients, businesses }: {
  clients: PipelineClient[];
  businesses: Business[];
}) {
  const [clients, setClients] = useState(initialClients);
  const [showAdd, setShowAdd] = useState(false);

  const reload = useCallback(async () => {
    const res = await fetch("/api/clients/pipeline");
    if (res.ok) setClients(await res.json());
  }, []);

  const moveClient = useCallback(async (id: string, stage: PipelineStage) => {
    // Optimistic update
    setClients(prev => prev.map(c => c.id === id ? { ...c, pipelineStage: stage } : c));
    await fetch("/api/clients/pipeline", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: id, pipelineStage: stage }),
    });
  }, []);

  // Clasificar clientes: los que no tienen stage van a "contacto"
  const byStage = VISIBLE_STAGES.reduce<Record<PipelineStage, PipelineClient[]>>((acc, s) => {
    acc[s] = [];
    return acc;
  }, {} as Record<PipelineStage, PipelineClient[]>);

  for (const c of clients) {
    const stage = c.pipelineStage ?? "contacto";
    if (stage !== "churned" && byStage[stage]) {
      byStage[stage].push(c);
    }
  }

  // Clientes churned separados
  const churned = clients.filter(c => c.pipelineStage === "churned");

  return (
    <div>
      <PipelineStats clients={clients} />

      {/* Header actions */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">
          {clients.length} contactos totales
          {churned.length > 0 && ` · ${churned.length} inactivos`}
        </p>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> Nuevo contacto
        </button>
      </div>

      {/* Kanban columns */}
      <div className="overflow-x-auto pb-4 -mx-1 px-1">
        <div className="flex gap-3 w-max min-w-full">
          {VISIBLE_STAGES.map(stage => (
            <StageColumn
              key={stage}
              stage={stage}
              clients={byStage[stage]}
              onMove={moveClient}
            />
          ))}
        </div>
      </div>

      {/* Quick add modal */}
      {showAdd && (
        <QuickAddModal
          businesses={businesses}
          onAdded={reload}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}
