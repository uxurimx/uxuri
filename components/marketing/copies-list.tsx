"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Eye, CheckCircle2, Archive, Clock, FileText, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Variables de ejemplo para preview en vivo
const PREVIEW_VARS: Record<string, string> = {
  nombre: "Clínica Dental Pérez",
  ciudad: "CDMX",
  nicho: "dentista",
  plataforma: "propio",
};

function renderPreview(content: string): string {
  return content
    .replace(/\{nombre\}/g, PREVIEW_VARS.nombre)
    .replace(/\{ciudad\}/g, PREVIEW_VARS.ciudad)
    .replace(/\{nicho\}/g, PREVIEW_VARS.nicho)
    .replace(/\{plataforma\}/g, PREVIEW_VARS.plataforma);
}

function charColor(len: number): string {
  if (len <= 200) return "text-green-600";
  if (len <= 400) return "text-amber-500";
  return "text-red-500";
}

const TYPE_CONFIG = {
  whatsapp_msg:  { label: "WhatsApp",     color: "bg-green-100 text-green-700" },
  email_subject: { label: "Asunto email", color: "bg-blue-100 text-blue-700" },
  email_body:    { label: "Email body",   color: "bg-blue-50 text-blue-600" },
  ig_dm:         { label: "Instagram DM", color: "bg-pink-100 text-pink-700" },
  script:        { label: "Script",       color: "bg-purple-100 text-purple-700" },
  cta:           { label: "CTA",          color: "bg-orange-100 text-orange-700" },
  other:         { label: "Otro",         color: "bg-slate-100 text-slate-600" },
} as const;

const STATUS_CONFIG = {
  draft:    { label: "Borrador",  icon: Clock,        color: "bg-slate-100 text-slate-600" },
  review:   { label: "Revisión", icon: Eye,          color: "bg-amber-50 text-amber-700" },
  approved: { label: "Aprobado", icon: CheckCircle2, color: "bg-emerald-50 text-emerald-700" },
  active:   { label: "Activo",   icon: CheckCircle2, color: "bg-blue-50 text-blue-700" },
  archived: { label: "Archivado",icon: Archive,      color: "bg-slate-50 text-slate-400" },
} as const;

const FRAMEWORK_CONFIG = {
  AIDA:         { label: "AIDA",           color: "bg-indigo-50 text-indigo-700" },
  PAS:          { label: "PAS",            color: "bg-purple-50 text-purple-700" },
  social_proof: { label: "Prueba social",  color: "bg-teal-50 text-teal-700" },
  FOMO:         { label: "FOMO",           color: "bg-rose-50 text-rose-700" },
  custom:       { label: "Personalizado",  color: "bg-slate-50 text-slate-600" },
} as const;

type CopyType = keyof typeof TYPE_CONFIG;
type CopyStatus = keyof typeof STATUS_CONFIG;
type Framework = keyof typeof FRAMEWORK_CONFIG;

interface MktCopy {
  id: string;
  title: string;
  content: string;
  type: CopyType;
  status: CopyStatus;
  abVariant: string | null;
  parentId: string | null;
  framework: Framework | null;
  tone: string | null;
  notes: string | null;
  createdAt: string;
}

export function CopiesList({ initialCopies }: { initialCopies: MktCopy[] }) {
  const router = useRouter();
  const [copies, setCopies] = useState<MktCopy[]>(initialCopies);
  const [showModal, setShowModal] = useState(false);
  const [editingCopy, setEditingCopy] = useState<MktCopy | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | CopyType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | CopyStatus>("all");
  const [saving, setSaving] = useState(false);

  // Form
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<CopyType>("whatsapp_msg");
  const [status, setStatus] = useState<CopyStatus>("draft");
  const [framework, setFramework] = useState<Framework | "">("");
  const [tone, setTone] = useState("");
  const [abVariant, setAbVariant] = useState("");
  const [notes, setNotes] = useState("");

  function openCreate() {
    setEditingCopy(null);
    setTitle(""); setContent(""); setType("whatsapp_msg"); setStatus("draft");
    setFramework(""); setTone(""); setAbVariant(""); setNotes("");
    setShowModal(true);
  }

  function openEdit(copy: MktCopy) {
    setEditingCopy(copy);
    setTitle(copy.title); setContent(copy.content); setType(copy.type); setStatus(copy.status);
    setFramework(copy.framework ?? ""); setTone(copy.tone ?? ""); setAbVariant(copy.abVariant ?? ""); setNotes(copy.notes ?? "");
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        content: content.trim(),
        type,
        status,
        framework: framework || null,
        tone: tone.trim() || null,
        abVariant: abVariant || null,
        notes: notes.trim() || null,
      };

      if (editingCopy) {
        const res = await fetch(`/api/mkt/copies/${editingCopy.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const updated = await res.json();
          setCopies((prev) => prev.map((c) => c.id === updated.id ? updated : c));
        }
      } else {
        const res = await fetch("/api/mkt/copies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const created = await res.json();
          setCopies((prev) => [created, ...prev]);
        }
      }
      setShowModal(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este copy? Esta acción no se puede deshacer.")) return;
    const res = await fetch(`/api/mkt/copies/${id}`, { method: "DELETE" });
    if (res.ok) setCopies((prev) => prev.filter((c) => c.id !== id));
  }

  async function handleArchive(id: string) {
    const res = await fetch(`/api/mkt/copies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
    if (res.ok) {
      setCopies((prev) => prev.map((c) => c.id === id ? { ...c, status: "archived" } : c));
    }
  }

  async function quickStatus(id: string, newStatus: CopyStatus) {
    const res = await fetch(`/api/mkt/copies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setCopies((prev) => prev.map((c) => c.id === id ? { ...c, status: newStatus } : c));
    }
  }

  const filtered = copies.filter(
    (c) =>
      (typeFilter === "all" || c.type === typeFilter) &&
      (statusFilter === "all" || c.status === statusFilter)
  );

  const preview = useMemo(() => renderPreview(content), [content]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#1e3a5f]/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-[#1e3a5f]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Copies</h1>
            <p className="text-sm text-slate-500">{copies.length} mensaje(s)</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#162d4a] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo copy
        </button>
      </div>

      {/* Filters */}
      {copies.length > 0 && (
        <div className="space-y-2 mb-6">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button onClick={() => setStatusFilter("all")} className={cn("whitespace-nowrap px-3 py-1.5 text-sm font-medium rounded-full transition-colors", statusFilter === "all" ? "bg-[#1e3a5f] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>Todos</button>
            {(Object.keys(STATUS_CONFIG) as CopyStatus[]).map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)} className={cn("whitespace-nowrap px-3 py-1.5 text-sm font-medium rounded-full transition-colors", statusFilter === s ? "bg-[#1e3a5f] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
                {STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button onClick={() => setTypeFilter("all")} className={cn("whitespace-nowrap px-3 py-1 text-xs font-medium rounded-full transition-colors", typeFilter === "all" ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>Todos los tipos</button>
            {(Object.keys(TYPE_CONFIG) as CopyType[]).map((t) => (
              <button key={t} onClick={() => setTypeFilter(t)} className={cn("whitespace-nowrap px-3 py-1 text-xs font-medium rounded-full transition-colors", typeFilter === t ? TYPE_CONFIG[t].color + " ring-1 ring-current" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>
                {TYPE_CONFIG[t].label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty */}
      {copies.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay copies todavía.</p>
          <button onClick={openCreate} className="mt-3 text-[#1e3a5f] text-sm hover:underline">Crea el primero →</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const tc = TYPE_CONFIG[c.type] ?? TYPE_CONFIG.other;
            const sc = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.draft;
            const StatusIcon = sc.icon;
            const isPreview = previewId === c.id;
            return (
              <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 hover:shadow-sm transition-all space-y-3 group">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 text-sm line-clamp-1">{c.title}</h3>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", tc.color)}>{tc.label}</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1", sc.color)}>
                        <StatusIcon className="w-3 h-3" />
                        {sc.label}
                      </span>
                      {c.abVariant && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-violet-50 text-violet-700">
                          Var. {c.abVariant}
                        </span>
                      )}
                      {c.framework && FRAMEWORK_CONFIG[c.framework] && (
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", FRAMEWORK_CONFIG[c.framework].color)}>
                          {FRAMEWORK_CONFIG[c.framework].label}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Content preview / live preview */}
                <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2.5 leading-relaxed font-mono whitespace-pre-wrap line-clamp-4">
                  {isPreview ? renderPreview(c.content) : c.content}
                </div>

                {/* Char count */}
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className={cn("font-medium", charColor(c.content.length))}>
                    {c.content.length} caracteres
                    {c.content.length > 400 && " ⚠️"}
                  </span>
                  <button
                    onClick={() => setPreviewId(isPreview ? null : c.id)}
                    className="flex items-center gap-1 text-slate-400 hover:text-[#1e3a5f] transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    {isPreview ? "Original" : "Preview"}
                  </button>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(c)} className="text-xs text-slate-500 hover:text-[#1e3a5f] transition-colors">Editar</button>
                  {(c.status === "draft" || c.status === "review") && (
                    <button onClick={() => quickStatus(c.id, "approved")} className="text-xs text-emerald-600 hover:text-emerald-700 transition-colors">Aprobar</button>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    {c.status !== "archived" && (
                      <button onClick={() => handleArchive(c.id)} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Archivar</button>
                    )}
                    <button onClick={() => handleDelete(c.id)} className="text-xs text-red-400 hover:text-red-600 transition-colors flex items-center gap-1">
                      <Trash2 className="w-3 h-3" />Eliminar
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal crear/editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">{editingCopy ? "Editar copy" : "Nuevo copy"}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nombre del copy *</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Copy A — Dentistas urgencia" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]" required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
                  <select value={type} onChange={(e) => setType(e.target.value as CopyType)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white">
                    {(Object.keys(TYPE_CONFIG) as CopyType[]).map((t) => (
                      <option key={t} value={t}>{TYPE_CONFIG[t].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Framework</label>
                  <select value={framework} onChange={(e) => setFramework(e.target.value as Framework | "")} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white">
                    <option value="">Sin framework</option>
                    {(Object.keys(FRAMEWORK_CONFIG) as Framework[]).map((f) => (
                      <option key={f} value={f}>{FRAMEWORK_CONFIG[f].label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Contenido + preview lado a lado en pantallas grandes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-600">Mensaje *</label>
                    <span className={cn("text-xs font-medium", charColor(content.length))}>
                      {content.length} chars
                    </span>
                  </div>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={8}
                    placeholder={"Hola {nombre} 👋\n\nVi que tu negocio está en {ciudad}...\n\nVariables: {nombre} {ciudad} {nicho} {plataforma}"}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] font-mono"
                    required
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Variables: <code className="bg-slate-100 px-1 rounded">{"{nombre}"}</code>{" "}
                    <code className="bg-slate-100 px-1 rounded">{"{ciudad}"}</code>{" "}
                    <code className="bg-slate-100 px-1 rounded">{"{nicho}"}</code>{" "}
                    <code className="bg-slate-100 px-1 rounded">{"{plataforma}"}</code>
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Preview (con datos de ejemplo)
                  </label>
                  <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-sm text-slate-700 whitespace-pre-wrap min-h-[180px] leading-relaxed">
                    {preview || <span className="text-slate-300 italic">El preview aparece aquí...</span>}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Ejemplo: <em>{PREVIEW_VARS.nombre}</em>, <em>{PREVIEW_VARS.ciudad}</em>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Tono</label>
                  <select value={tone} onChange={(e) => setTone(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white">
                    <option value="">Sin definir</option>
                    <option value="amigable">Amigable</option>
                    <option value="profesional">Profesional</option>
                    <option value="urgente">Urgente</option>
                    <option value="empático">Empático</option>
                    <option value="directo">Directo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Variante A/B</label>
                  <select value={abVariant} onChange={(e) => setAbVariant(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white">
                    <option value="">Sin variante</option>
                    <option value="A">Variante A</option>
                    <option value="B">Variante B</option>
                    <option value="C">Variante C</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Estado</label>
                <div className="flex gap-2 flex-wrap">
                  {(Object.keys(STATUS_CONFIG) as CopyStatus[]).map((s) => (
                    <button key={s} type="button" onClick={() => setStatus(s)}
                      className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                        status === s ? "border-[#1e3a5f] bg-[#1e3a5f]/5 text-[#1e3a5f]" : "border-slate-200 text-slate-500 hover:border-slate-300"
                      )}>
                      {STATUS_CONFIG[s].label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors">Cancelar</button>
                <button type="submit" disabled={saving || !title.trim() || !content.trim()} className="flex-1 px-4 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#162d4a] disabled:opacity-50 transition-colors">
                  {saving ? "Guardando..." : editingCopy ? "Guardar cambios" : "Crear copy"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
