"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Phone, Mail, Globe, MapPin, Star, MessageSquare,
  CheckCircle2, XCircle, Clock, TrendingUp, UserPlus,
  Send, FileText, X, ExternalLink, Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeadStatus } from "./leads-table";

// ── Tipos ──────────────────────────────────��───────────────────────────────────

interface Interaction {
  id: string;
  type: string;
  message: string | null;
  copyId: string | null;
  campaignId: string | null;
  workerId: string | null;
  workerName?: string | null;
  createdAt: string;
}

interface Lead {
  id: string;
  name: string | null;
  category: string | null;
  niche: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  rating: number | null;
  reviews: number | null;
  webSource: string | null;
  hasWhatsapp: number | null;
  score: number | null;
  socialFb: string | null;
  socialIg: string | null;
  status: LeadStatus;
  notes: string | null;
  templateUsed: string | null;
  contactedAt: string | null;
  lastActivity: string | null;
  followupStep: number;
  nextFollowup: string | null;
  convertedToClientId: string | null;
  convertedAt: string | null;
  campaignId: string | null;
  strategyId: string | null;
  copyId: string | null;
  createdAt: string;
}

interface LeadDetailProps {
  lead: Lead;
  interactions: Interaction[];
  campaignTitle?: string | null;
  strategyTitle?: string | null;
  copyTitle?: string | null;
}

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<LeadStatus, { label: string; badge: string }> = {
  nuevo:        { label: "Nuevo",          badge: "bg-blue-100 text-blue-700" },
  pendiente:    { label: "Pendiente",      badge: "bg-cyan-100 text-cyan-700" },
  contactado:   { label: "Contactado",     badge: "bg-yellow-100 text-yellow-700" },
  interesado:   { label: "Interesado",     badge: "bg-emerald-100 text-emerald-700" },
  no_responde:  { label: "Sin respuesta",  badge: "bg-slate-100 text-slate-500" },
  sin_whatsapp: { label: "Sin WhatsApp",   badge: "bg-orange-100 text-orange-700" },
  descartado:   { label: "Descartado",     badge: "bg-red-100 text-red-600" },
  cerrado:      { label: "Cerrado",        badge: "bg-purple-100 text-purple-700" },
};

const INTERACTION_CONFIG: Record<string, { label: string; icon: typeof Send; color: string; border: string }> = {
  scraped:          { label: "Scrapeado",        icon: FileText,    color: "text-slate-400",  border: "border-slate-200" },
  sent:             { label: "Mensaje enviado",  icon: Send,        color: "text-blue-500",   border: "border-blue-200" },
  replied:          { label: "Respondió",        icon: MessageSquare, color: "text-emerald-500", border: "border-emerald-200" },
  followup_sent:    { label: "Follow-up enviado",icon: Send,        color: "text-amber-500",  border: "border-amber-200" },
  followup_replied: { label: "Resp. follow-up",  icon: MessageSquare, color: "text-emerald-500", border: "border-emerald-300" },
  interested:       { label: "Interesado",       icon: TrendingUp,  color: "text-emerald-600",border: "border-emerald-300" },
  not_interested:   { label: "No interesado",    icon: XCircle,     color: "text-red-400",    border: "border-red-200" },
  call:             { label: "Llamada",           icon: Phone,       color: "text-purple-500", border: "border-purple-200" },
  meeting:          { label: "Reunión",           icon: Calendar,    color: "text-indigo-500", border: "border-indigo-200" },
  converted:        { label: "Convertido",        icon: CheckCircle2,color: "text-purple-600", border: "border-purple-300" },
  lost:             { label: "Perdido",           icon: XCircle,     color: "text-red-500",    border: "border-red-300" },
  note:             { label: "Nota",              icon: FileText,    color: "text-slate-500",  border: "border-slate-200" },
};

function fmt(d: string | null, full = false): string {
  if (!d) return "—";
  const date = new Date(d);
  if (full) return date.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

// ── Componente ────────────────────────────���────────────────────────��──────────

export function LeadDetail({ lead, interactions: initialInteractions, campaignTitle, strategyTitle, copyTitle }: LeadDetailProps) {
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [interactions, setInteractions] = useState<Interaction[]>(initialInteractions);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [convertedClientId, setConvertedClientId] = useState<string | null>(lead.convertedToClientId);

  // Convert form
  const [cName, setCName] = useState(lead.name ?? "");
  const [cEmail, setCEmail] = useState(lead.email ?? "");
  const [cPhone, setCPhone] = useState(lead.phone ?? "");
  const [cWebsite, setCWebsite] = useState(lead.website ?? "");
  const [cNotes, setCNotes] = useState("");
  const [converting, setConverting] = useState(false);

  async function handleStatusChange(newStatus: LeadStatus) {
    setStatus(newStatus);
    await fetch(`/api/mkt/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch("/api/mkt/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, type: "note", message: noteText.trim() }),
      });
      if (res.ok) {
        const interaction = await res.json();
        setInteractions((prev) => [...prev, { ...interaction, createdAt: new Date().toISOString() }]);
        setNoteText("");
      }
    } finally {
      setSavingNote(false);
    }
  }

  async function handleConvert(e: React.FormEvent) {
    e.preventDefault();
    if (!cName.trim()) return;
    setConverting(true);
    try {
      const res = await fetch(`/api/mkt/leads/${lead.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cName.trim(),
          email: cEmail.trim() || null,
          phone: cPhone.trim() || null,
          website: cWebsite.trim() || null,
          notes: cNotes.trim() || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setConvertedClientId(data.client.id);
        setStatus("cerrado");
        setShowConvert(false);
        setInteractions((prev) => [...prev, {
          id: Date.now().toString(),
          type: "converted",
          message: `Convertido al cliente "${data.client.name}"`,
          copyId: null, campaignId: null, workerId: null,
          createdAt: new Date().toISOString(),
        }]);
      }
    } finally {
      setConverting(false);
    }
  }

  const sc = STATUS_CONFIG[status] ?? STATUS_CONFIG.nuevo;
  const scoreColor = !lead.score ? "bg-slate-100 text-slate-500"
    : lead.score >= 8 ? "bg-emerald-100 text-emerald-700"
    : lead.score >= 5 ? "bg-amber-100 text-amber-700"
    : "bg-red-100 text-red-600";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Columna izquierda: info + acciones */}
      <div className="lg:col-span-1 space-y-4">
        {/* Card principal */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-bold text-slate-900 text-lg leading-tight">{lead.name ?? "Sin nombre"}</h2>
              {lead.category && <p className="text-sm text-slate-500 mt-0.5">{lead.category}</p>}
            </div>
            {lead.score != null && (
              <span className={cn("text-sm font-bold px-2.5 py-1 rounded-full shrink-0", scoreColor)}>
                {lead.score}/10
              </span>
            )}
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5">
            {lead.niche && <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">{lead.niche}</span>}
            {lead.city && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">📍 {lead.city}{lead.country !== "México" ? `, ${lead.country}` : ""}</span>}
            {lead.rating != null && lead.rating > 0 && <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">★ {lead.rating.toFixed(1)} ({lead.reviews ?? 0})</span>}
            {lead.webSource && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{lead.webSource}</span>}
          </div>

          {/* Contacto */}
          <div className="space-y-2 text-sm">
            {lead.phone && (
              <div className="flex items-center gap-2 text-slate-700">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-mono">{lead.phone}</span>
                {lead.hasWhatsapp === 1 && <span className="text-xs text-emerald-600 font-medium">WA ✓</span>}
                {lead.hasWhatsapp === 0 && <span className="text-xs text-red-400">Sin WA</span>}
              </div>
            )}
            {lead.email && (
              <div className="flex items-center gap-2 text-slate-700">
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <a href={`mailto:${lead.email}`} className="hover:text-[#1e3a5f] transition-colors truncate">{lead.email}</a>
              </div>
            )}
            {lead.website && (
              <div className="flex items-center gap-2 text-slate-700">
                <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <a href={lead.website} target="_blank" rel="noopener noreferrer" className="hover:text-[#1e3a5f] transition-colors truncate flex items-center gap-1">
                  {lead.website.replace(/^https?:\/\//, "").slice(0, 30)}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
            {lead.address && (
              <div className="flex items-start gap-2 text-slate-500">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span className="text-xs leading-relaxed">{lead.address}</span>
              </div>
            )}
          </div>

          {/* Redes */}
          {(lead.socialIg || lead.socialFb) && (
            <div className="flex gap-2 flex-wrap pt-1 border-t border-slate-100">
              {lead.socialIg && <a href={lead.socialIg} target="_blank" rel="noopener" className="text-xs text-pink-600 hover:underline">Instagram →</a>}
              {lead.socialFb && <a href={lead.socialFb} target="_blank" rel="noopener" className="text-xs text-blue-600 hover:underline">Facebook →</a>}
            </div>
          )}
        </div>

        {/* Status manager */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado actual</p>
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", sc.badge)}>{sc.label}</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.keys(STATUS_CONFIG) as LeadStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                className={cn(
                  "text-xs px-2 py-1.5 rounded-lg border font-medium transition-colors text-left",
                  status === s
                    ? STATUS_CONFIG[s].badge + " border-current"
                    : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                {STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
        </div>

        {/* Campaña vinculada */}
        {(campaignTitle || strategyTitle || copyTitle) && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Campaña</p>
            {strategyTitle && <p className="text-xs text-slate-600"><span className="text-slate-400">Estrategia:</span> {strategyTitle}</p>}
            {campaignTitle && <p className="text-xs text-slate-600"><span className="text-slate-400">Campaña:</span> <Link href={`/marketing/campaigns/${lead.campaignId}`} className="text-[#1e3a5f] hover:underline">{campaignTitle}</Link></p>}
            {copyTitle && <p className="text-xs text-slate-600"><span className="text-slate-400">Copy:</span> {copyTitle}</p>}
            {lead.templateUsed && <p className="text-xs text-slate-600"><span className="text-slate-400">Variante:</span> {lead.templateUsed}</p>}
          </div>
        )}

        {/* Fechas */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Seguimiento</p>
          {lead.contactedAt && <p className="text-xs text-slate-600"><span className="text-slate-400">Contactado:</span> {fmt(lead.contactedAt, true)}</p>}
          {lead.lastActivity && <p className="text-xs text-slate-600"><span className="text-slate-400">Últ. actividad:</span> {fmt(lead.lastActivity, true)}</p>}
          {lead.nextFollowup && <p className="text-xs text-emerald-700"><span className="text-slate-400">Próx. follow-up:</span> {fmt(lead.nextFollowup, true)}</p>}
          <p className="text-xs text-slate-400">Follow-up #{lead.followupStep}</p>
        </div>

        {/* Convertir a cliente */}
        {convertedClientId ? (
          <Link
            href={`/clients/${convertedClientId}`}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-purple-50 text-purple-700 rounded-xl border border-purple-100 text-sm font-medium hover:bg-purple-100 transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            Ver cliente creado →
          </Link>
        ) : (
          <button
            onClick={() => setShowConvert(true)}
            disabled={status === "descartado"}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[#1e3a5f] text-white rounded-xl text-sm font-medium hover:bg-[#162d4a] disabled:opacity-40 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Convertir a cliente
          </button>
        )}
      </div>

      {/* Columna derecha: timeline + nota */}
      <div className="lg:col-span-2 space-y-4">
        {/* Add note */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <form onSubmit={handleAddNote} className="flex gap-2">
            <input
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Agregar nota o comentario sobre este lead..."
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
            />
            <button
              type="submit"
              disabled={savingNote || !noteText.trim()}
              className="px-4 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#162d4a] disabled:opacity-40 transition-colors shrink-0"
            >
              {savingNote ? "..." : "Guardar"}
            </button>
          </form>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">Historial de interacciones</h3>
          </div>
          {interactions.length === 0 ? (
            <div className="px-5 py-10 text-center text-slate-400 text-sm">
              <Clock className="w-8 h-8 mx-auto mb-3 opacity-30" />
              Sin interacciones registradas.
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {[...interactions].reverse().map((interaction) => {
                const cfg = INTERACTION_CONFIG[interaction.type] ?? INTERACTION_CONFIG.note;
                const Icon = cfg.icon;
                return (
                  <div key={interaction.id} className={cn("flex gap-3 px-5 py-3 border-l-2", cfg.border)}>
                    <div className={cn("mt-0.5 shrink-0", cfg.color)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn("text-xs font-semibold", cfg.color)}>{cfg.label}</span>
                        {interaction.workerName && (
                          <span className="text-xs text-slate-400">· {interaction.workerName}</span>
                        )}
                        <span className="text-xs text-slate-300 ml-auto">{fmt(interaction.createdAt)}</span>
                      </div>
                      {interaction.message && (
                        <p className="text-sm text-slate-600 mt-1 leading-relaxed whitespace-pre-wrap">{interaction.message}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Notas del lead */}
        {lead.notes && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
            <p className="text-xs font-medium text-amber-700 mb-1">Notas del lead</p>
            <p className="text-sm text-amber-900 whitespace-pre-wrap">{lead.notes}</p>
          </div>
        )}
      </div>

      {/* Modal Convertir a cliente */}
      {showConvert && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
              <div>
                <h2 className="font-semibold text-slate-900">Convertir a cliente</h2>
                <p className="text-xs text-slate-400 mt-0.5">Revisa los datos antes de crear el cliente</p>
              </div>
              <button onClick={() => setShowConvert(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleConvert} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
                <input value={cName} onChange={(e) => setCName(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Teléfono</label>
                  <input value={cPhone} onChange={(e) => setCPhone(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                  <input value={cEmail} onChange={(e) => setCEmail(e.target.value)} type="email" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Sitio web</label>
                <input value={cWebsite} onChange={(e) => setCWebsite(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notas adicionales</label>
                <textarea value={cNotes} onChange={(e) => setCNotes(e.target.value)} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20" placeholder="Contexto, acuerdos, próximos pasos..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowConvert(false)} className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors">Cancelar</button>
                <button type="submit" disabled={converting || !cName.trim()} className="flex-1 px-4 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
                  {converting ? "Creando..." : "Crear cliente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
