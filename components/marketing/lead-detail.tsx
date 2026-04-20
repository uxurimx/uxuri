"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Phone, Mail, Globe, MapPin, Star, MessageSquare,
  CheckCircle2, XCircle, Clock, TrendingUp, UserPlus,
  Send, FileText, X, ExternalLink, Calendar,
  Sparkles, Brain, ChevronDown, ChevronUp, Copy,
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

export interface SocialData {
  ig?: { followers?: number; bio?: string; posts_count?: number; is_verified?: boolean; url?: string } | null;
  fb?: { likes?: number; rating?: number; description?: string } | null;
  gmaps_reviews?: { total_reviews?: number; avg_rating?: number; negative_count?: number; pain_themes?: string[]; recent_complaints?: string[] } | null;
  pain_points?: string[];
  ai_copy?: {
    research?: { main_problem?: string; opportunity?: string; angle?: string; hook?: string; context?: string };
    variants?: { variant: string; content: string; tone: string; framework: string }[];
    framework?: string;
    generated_at?: string;
  };
  enriched_at?: string;
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
  menuUrl: string | null;
  address: string | null;
  rating: number | null;
  reviews: number | null;
  webSource: string | null;
  hasWhatsapp: number | null;
  score: number | null;
  socialFb: string | null;
  socialIg: string | null;
  socialData: SocialData | null;
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
  const [socialOpen, setSocialOpen] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [sendingWa, setSendingWa] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [enrichMsg, setEnrichMsg] = useState<string | null>(null);

  // Convert form
  const [cName, setCName] = useState(lead.name ?? "");
  const [cEmail, setCEmail] = useState(lead.email ?? "");
  const [cPhone, setCPhone] = useState(lead.phone ?? "");
  const [cWebsite, setCWebsite] = useState(lead.website ?? "");
  const [cNotes, setCNotes] = useState("");
  const [converting, setConverting] = useState(false);

  async function handleEnrich() {
    setEnriching(true);
    setEnrichMsg(null);
    try {
      const res = await fetch(`/api/mkt/leads/${lead.id}/enrich`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setEnrichMsg(`Error: ${data.error}`); return; }
      setEnrichMsg(`Job iniciado (${data.jobId}) — puede tardar unos minutos`);
    } catch (e) {
      setEnrichMsg(String(e));
    } finally {
      setEnriching(false);
    }
  }

  async function handleSendWa() {
    if (!lead.phone) return;
    if (!confirm(`Enviar WhatsApp a ${lead.name ?? lead.phone}?`)) return;
    setSendingWa(true);
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
      setSendingWa(false);
    }
  }

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

  function copyToClipboard(text: string, idx: number) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    });
  }

  const sd = lead.socialData;

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

        {/* Enriquecer */}
        <div className="space-y-2">
          <button
            onClick={handleEnrich}
            disabled={enriching}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-xl text-sm font-medium hover:bg-purple-100 disabled:opacity-40 transition-colors"
          >
            <Sparkles className={cn("w-4 h-4", enriching && "animate-spin")} />
            {enriching ? "Iniciando…" : "Enriquecer (IG / FB / Maps)"}
          </button>
          {enrichMsg && (
            <p className="text-xs text-center text-slate-500 px-2">{enrichMsg}</p>
          )}
        </div>

        {/* Enviar WhatsApp */}
        {lead.phone && (
          <button
            onClick={handleSendWa}
            disabled={sendingWa}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[#25d366] text-white rounded-xl text-sm font-medium hover:bg-[#1ebe5a] disabled:opacity-40 transition-colors"
          >
            <Send className="w-4 h-4" />
            {sendingWa ? "Enviando…" : "Enviar WhatsApp"}
          </button>
        )}

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

        {/* Datos de enriquecimiento */}
        {sd && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <button
              onClick={() => setSocialOpen((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <span className="font-semibold text-slate-800 text-sm">Datos de enriquecimiento</span>
                {sd.enriched_at && (
                  <span className="text-xs text-slate-400">{fmt(sd.enriched_at)}</span>
                )}
              </div>
              {socialOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {socialOpen && (
              <div className="border-t border-slate-100 divide-y divide-slate-50">
                {/* Pain Points */}
                {sd.pain_points && sd.pain_points.length > 0 && (
                  <div className="px-5 py-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Pain Points</p>
                    <ul className="space-y-1.5">
                      {sd.pain_points.map((p, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                          <span className="text-orange-400 mt-0.5 shrink-0">•</span>
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Instagram */}
                {sd.ig && (
                  <div className="px-5 py-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Instagram</p>
                    <div className="grid grid-cols-3 gap-3">
                      {sd.ig.followers != null && (
                        <div className="text-center">
                          <p className="text-lg font-bold text-slate-800">{sd.ig.followers.toLocaleString()}</p>
                          <p className="text-xs text-slate-400">seguidores</p>
                        </div>
                      )}
                      {sd.ig.posts_count != null && (
                        <div className="text-center">
                          <p className="text-lg font-bold text-slate-800">{sd.ig.posts_count}</p>
                          <p className="text-xs text-slate-400">posts</p>
                        </div>
                      )}
                      {sd.ig.is_verified && (
                        <div className="text-center">
                          <p className="text-lg font-bold text-blue-500">✓</p>
                          <p className="text-xs text-slate-400">verificado</p>
                        </div>
                      )}
                    </div>
                    {sd.ig.bio && <p className="text-xs text-slate-500 mt-2 italic">"{sd.ig.bio.slice(0, 100)}{sd.ig.bio.length > 100 ? "…" : ""}"</p>}
                  </div>
                )}

                {/* Facebook */}
                {sd.fb && (
                  <div className="px-5 py-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Facebook</p>
                    <div className="flex gap-6">
                      {sd.fb.likes != null && (
                        <div>
                          <p className="text-lg font-bold text-slate-800">{sd.fb.likes.toLocaleString()}</p>
                          <p className="text-xs text-slate-400">likes</p>
                        </div>
                      )}
                      {sd.fb.rating != null && (
                        <div>
                          <p className="text-lg font-bold text-slate-800">★ {sd.fb.rating}</p>
                          <p className="text-xs text-slate-400">rating</p>
                        </div>
                      )}
                    </div>
                    {sd.fb.description && <p className="text-xs text-slate-500 mt-2 italic">"{sd.fb.description.slice(0, 100)}{sd.fb.description.length > 100 ? "…" : ""}"</p>}
                  </div>
                )}

                {/* Google Maps Reviews */}
                {sd.gmaps_reviews && (
                  <div className="px-5 py-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Reseñas Google Maps</p>
                    <div className="flex gap-6 mb-2">
                      {sd.gmaps_reviews.total_reviews != null && (
                        <div>
                          <p className="text-lg font-bold text-slate-800">{sd.gmaps_reviews.total_reviews}</p>
                          <p className="text-xs text-slate-400">total reseñas</p>
                        </div>
                      )}
                      {sd.gmaps_reviews.negative_count != null && (
                        <div>
                          <p className="text-lg font-bold text-red-500">{sd.gmaps_reviews.negative_count}</p>
                          <p className="text-xs text-slate-400">negativas</p>
                        </div>
                      )}
                    </div>
                    {sd.gmaps_reviews.pain_themes && sd.gmaps_reviews.pain_themes.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {sd.gmaps_reviews.pain_themes.map((t, i) => (
                          <span key={i} className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* AI Copy */}
                {sd.ai_copy && (
                  <div className="px-5 py-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Brain className="w-4 h-4 text-purple-500" />
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">AI Copy — {sd.ai_copy.framework}</p>
                      {sd.ai_copy.generated_at && (
                        <span className="text-xs text-slate-400 ml-auto">{fmt(sd.ai_copy.generated_at)}</span>
                      )}
                    </div>
                    {sd.ai_copy.research?.main_problem && (
                      <p className="text-xs text-slate-500 mb-3 bg-slate-50 rounded-lg p-2">
                        <span className="font-medium text-slate-600">Problema: </span>
                        {sd.ai_copy.research.main_problem}
                      </p>
                    )}
                    <div className="space-y-3">
                      {sd.ai_copy.variants?.map((v, i) => (
                        <div key={i} className="bg-purple-50 rounded-lg p-3 relative">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-xs font-bold text-purple-700 bg-purple-200 px-1.5 py-0.5 rounded">Variante {v.variant}</span>
                            {v.tone && <span className="text-xs text-slate-400">{v.tone}</span>}
                            <button
                              onClick={() => copyToClipboard(v.content, i)}
                              className="ml-auto text-slate-400 hover:text-purple-600 transition-colors"
                              title="Copiar al portapapeles"
                            >
                              {copiedIdx === i ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{v.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
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
