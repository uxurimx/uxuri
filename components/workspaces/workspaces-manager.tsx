"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Archive, Pencil, Trash2, Crown, Users, Shield,
  X, Check, ChevronRight, Building2, User,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Workspace = {
  id: string;
  name: string;
  slug: string;
  type: "personal" | "business";
  description: string | null;
  brandName: string | null;
  color: string | null;
  icon: string | null;
  ownerId: string;
  isArchived: boolean;
};

type Profile = {
  id: string;
  workspaceId: string;
  name: string;
  label: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  permissions: string[];
  defaultRoute: string | null;
  isSystem: boolean;
};

type Entry = {
  workspace: Workspace;
  isOwner: boolean;
  memberId: string;
  profiles: Profile[];
  myProfileIds: string[];
};

const ALL_ROUTES = [
  "/dashboard", "/clients", "/clients/pipeline", "/projects", "/tasks",
  "/today", "/agents", "/objectives", "/planning", "/habits", "/journal",
  "/notes", "/schedule", "/review", "/chat", "/users", "/finanzas",
  "/comidas", "/negocios", "/marketing", "/settings", "/workspaces",
];

const ROUTE_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/clients": "Clientes",
  "/clients/pipeline": "Pipeline CRM",
  "/projects": "Proyectos",
  "/tasks": "Tareas",
  "/today": "Hoy",
  "/agents": "Agentes",
  "/objectives": "Objetivos",
  "/planning": "Planeación",
  "/habits": "Hábitos",
  "/journal": "Diario",
  "/notes": "Notas",
  "/schedule": "Agenda",
  "/review": "Revisión",
  "/chat": "Chat",
  "/users": "Usuarios",
  "/finanzas": "Finanzas",
  "/comidas": "Comidas",
  "/negocios": "Negocios",
  "/marketing": "Marketing",
  "/settings": "Configuración",
  "/workspaces": "Workspaces",
};

const ICONS = ["🏢", "🏠", "💼", "🚀", "⚡", "🎯", "💡", "🔧", "🌐", "🎨", "📊", "🤖"];
const PROFILE_ICONS = ["👤", "👑", "💻", "🧪", "🎨", "📊", "🔧", "🌐", "⚡", "🎯", "📱", "🔬"];
const COLORS = [
  "#1e3a5f", "#7c3aed", "#059669", "#d97706",
  "#dc2626", "#0891b2", "#be185d", "#374151",
];

/* ─────────────────────────  MODAL BASE  ───────────────────────── */

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-900 rounded-t-2xl">
          <h2 className="font-bold text-slate-900 dark:text-slate-100 text-lg">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

/* ─────────────────────────  FORM FIELD  ───────────────────────── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls = "w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition";

/* ─────────────────────────  EMOJI PICKER  ───────────────────────── */

function EmojiPicker({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((e) => (
        <button
          key={e}
          type="button"
          onClick={() => onChange(e)}
          className={cn(
            "w-9 h-9 flex items-center justify-center rounded-lg text-lg border transition",
            value === e
              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
              : "border-slate-200 dark:border-slate-700 hover:border-slate-400 bg-white dark:bg-slate-800"
          )}
        >
          {e}
        </button>
      ))}
    </div>
  );
}

/* ─────────────────────────  COLOR PICKER  ───────────────────────── */

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={cn(
            "w-8 h-8 rounded-lg border-2 transition",
            value === c ? "border-slate-900 dark:border-white scale-110" : "border-transparent"
          )}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}

/* ─────────────────────────  CREATE WORKSPACE MODAL  ───────────────────────── */

function CreateWorkspaceModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: "",
    type: "business" as "personal" | "business",
    description: "",
    icon: "🏢",
    color: "#1e3a5f",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const slug = form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, slug }),
      });
      if (res.ok) {
        onCreated();
      } else {
        const j = await res.json();
        const msg = typeof j.error === "string" ? j.error : "Error al crear el workspace";
        if (msg.includes("Slug ya existe")) {
          const uniqueSlug = slug + "-" + Date.now().toString(36);
          const res2 = await fetch("/api/workspaces", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...form, slug: uniqueSlug }),
          });
          if (res2.ok) { onCreated(); return; }
        }
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Nuevo workspace" onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <Field label="Nombre del workspace">
          <input
            required
            autoFocus
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Mi empresa, Personal, etc."
            className={inputCls}
          />
        </Field>

        <Field label="Tipo">
          <div className="grid grid-cols-2 gap-3">
            {(["business", "personal"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm((f) => ({ ...f, type: t }))}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-medium transition",
                  form.type === t
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300"
                )}
              >
                {t === "business" ? <Building2 className="w-4 h-4" /> : <User className="w-4 h-4" />}
                {t === "business" ? "Empresa" : "Personal"}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Ícono">
          <EmojiPicker value={form.icon} onChange={(v) => setForm((f) => ({ ...f, icon: v }))} options={ICONS} />
        </Field>

        <Field label="Color de acento">
          <ColorPicker value={form.color} onChange={(v) => setForm((f) => ({ ...f, color: v }))} />
        </Field>

        <Field label="Descripción (opcional)">
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
            placeholder="¿Para qué es este workspace?"
            className={cn(inputCls, "h-auto pt-2")}
          />
        </Field>

        {error && (
          <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={busy || !form.name.trim()}
            className="flex-1 h-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition"
          >
            {busy ? "Creando..." : "Crear workspace"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ─────────────────────────  EDIT WORKSPACE MODAL  ───────────────────────── */

function EditWorkspaceModal({
  workspace,
  onClose,
  onSaved,
}: {
  workspace: Workspace;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: workspace.name,
    description: workspace.description ?? "",
    icon: workspace.icon ?? "🏢",
    color: workspace.color ?? "#1e3a5f",
  });
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Editar workspace" onClose={onClose}>
      <form onSubmit={save} className="space-y-5">
        <Field label="Nombre">
          <input
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className={inputCls}
          />
        </Field>

        <Field label="Ícono">
          <EmojiPicker value={form.icon} onChange={(v) => setForm((f) => ({ ...f, icon: v }))} options={ICONS} />
        </Field>

        <Field label="Color de acento">
          <ColorPicker value={form.color} onChange={(v) => setForm((f) => ({ ...f, color: v }))} />
        </Field>

        <Field label="Descripción">
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
            className={cn(inputCls, "h-auto pt-2")}
          />
        </Field>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 h-10 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
            Cancelar
          </button>
          <button type="submit" disabled={busy} className="flex-1 h-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition">
            {busy ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ─────────────────────────  PROFILE MODAL  ───────────────────────── */

function ProfileModal({
  workspaceId,
  profile,
  onClose,
  onSaved,
}: {
  workspaceId: string;
  profile?: Profile;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    label: profile?.label ?? "",
    description: profile?.description ?? "",
    icon: profile?.icon ?? "👤",
    color: profile?.color ?? "#1e3a5f",
    permissions: new Set<string>(profile?.permissions ?? []),
    defaultRoute: profile?.defaultRoute ?? "/dashboard",
  });
  const [busy, setBusy] = useState(false);

  function toggleRoute(route: string) {
    setForm((f) => {
      const next = new Set(f.permissions);
      if (next.has(route)) next.delete(route);
      else next.add(route);
      const defaultRoute = next.has(f.defaultRoute) ? f.defaultRoute : (next.has("/dashboard") ? "/dashboard" : [...next][0] ?? "/dashboard");
      return { ...f, permissions: next, defaultRoute };
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const name = form.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const payload = {
        name: profile?.name ?? name,
        label: form.label,
        description: form.description,
        icon: form.icon,
        color: form.color,
        permissions: Array.from(form.permissions),
        defaultRoute: form.defaultRoute,
      };
      const url = profile
        ? `/api/workspaces/${workspaceId}/profiles/${profile.id}`
        : `/api/workspaces/${workspaceId}/profiles`;
      const res = await fetch(url, {
        method: profile ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) onSaved();
    } finally {
      setBusy(false);
    }
  }

  const selected = form.permissions.size;

  return (
    <Modal title={profile ? "Editar perfil" : "Nuevo perfil"} onClose={onClose}>
      <form onSubmit={save} className="space-y-5">
        <Field label="Nombre del perfil">
          <input
            required
            autoFocus
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            placeholder="Admin, Desarrollador, Diseñador..."
            className={inputCls}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Ícono">
            <EmojiPicker value={form.icon} onChange={(v) => setForm((f) => ({ ...f, icon: v }))} options={PROFILE_ICONS} />
          </Field>
          <Field label="Color">
            <ColorPicker value={form.color} onChange={(v) => setForm((f) => ({ ...f, color: v }))} />
          </Field>
        </div>

        <Field label="Descripción (opcional)">
          <input
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="¿Qué hace este perfil?"
            className={inputCls}
          />
        </Field>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Secciones permitidas
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {selected}/{ALL_ROUTES.length} seleccionadas
            </span>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/50 max-h-52 overflow-y-auto">
            {ALL_ROUTES.map((r) => (
              <label
                key={r}
                className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition select-none"
              >
                <div
                  className={cn(
                    "w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition",
                    form.permissions.has(r)
                      ? "bg-blue-500 border-blue-500"
                      : "border-slate-300 dark:border-slate-600"
                  )}
                  onClick={() => toggleRoute(r)}
                >
                  {form.permissions.has(r) && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
                <span className="text-sm text-slate-700 dark:text-slate-300">{ROUTE_LABELS[r] ?? r}</span>
                <span className="ml-auto text-[11px] font-mono text-slate-400 dark:text-slate-500">{r}</span>
              </label>
            ))}
          </div>
        </div>

        <Field label="Ruta de inicio">
          <select
            value={form.defaultRoute}
            onChange={(e) => setForm((f) => ({ ...f, defaultRoute: e.target.value }))}
            className={inputCls}
          >
            {ALL_ROUTES.filter((r) => form.permissions.has(r)).map((r) => (
              <option key={r} value={r}>{ROUTE_LABELS[r] ?? r}</option>
            ))}
          </select>
        </Field>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 h-10 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={busy || !form.label.trim()}
            className="flex-1 h-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition"
          >
            {busy ? "Guardando..." : profile ? "Guardar cambios" : "Crear perfil"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ─────────────────────────  WORKSPACE CARD  ───────────────────────── */

function WorkspaceCard({
  entry,
  isActive,
  onChange,
}: {
  entry: Entry;
  isActive: boolean;
  onChange: () => void;
}) {
  const { workspace, isOwner, profiles, myProfileIds } = entry;
  const [editingWs, setEditingWs] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [creatingProfile, setCreatingProfile] = useState(false);
  const [busy, setBusy] = useState(false);

  async function archive() {
    if (!confirm(`¿Archivar "${workspace.name}"? Ya no aparecerá en el selector.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}`, { method: "DELETE" });
      if (res.ok) onChange();
    } finally {
      setBusy(false);
    }
  }

  async function deleteProfile(profileId: string) {
    if (!confirm("¿Eliminar este perfil? Los miembros perderán ese acceso.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/profiles/${profileId}`, { method: "DELETE" });
      if (res.ok) onChange();
    } finally {
      setBusy(false);
    }
  }

  const color = workspace.color ?? "#1e3a5f";

  return (
    <>
      {editingWs && (
        <EditWorkspaceModal
          workspace={workspace}
          onClose={() => setEditingWs(false)}
          onSaved={() => { setEditingWs(false); onChange(); }}
        />
      )}
      {creatingProfile && (
        <ProfileModal
          workspaceId={workspace.id}
          onClose={() => setCreatingProfile(false)}
          onSaved={() => { setCreatingProfile(false); onChange(); }}
        />
      )}
      {editingProfile && (
        <ProfileModal
          workspaceId={workspace.id}
          profile={editingProfile}
          onClose={() => setEditingProfile(null)}
          onSaved={() => { setEditingProfile(null); onChange(); }}
        />
      )}

      <article className={cn(
        "bg-white dark:bg-slate-900 rounded-2xl border overflow-hidden transition",
        isActive
          ? "border-blue-400 dark:border-blue-500 ring-2 ring-blue-400/20"
          : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
      )}>
        {/* Color bar */}
        <div className="h-1.5" style={{ backgroundColor: color }} />

        {/* Header */}
        <div className="flex items-start gap-4 p-5 pb-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
            style={{ backgroundColor: color + "18" }}
          >
            {workspace.icon ?? "🏢"}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-slate-900 dark:text-slate-100 text-lg leading-tight">
                {workspace.name}
              </h2>
              {isOwner && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                  <Crown className="w-3 h-3" /> Owner
                </span>
              )}
              {isActive && (
                <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                  Activo
                </span>
              )}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                {workspace.type === "business" ? <Building2 className="w-3 h-3" /> : <User className="w-3 h-3" />}
                {workspace.type === "business" ? "Empresa" : "Personal"}
              </span>
            </div>
            {workspace.description && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                {workspace.description}
              </p>
            )}
          </div>

          {isOwner && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={() => setEditingWs(true)}
                disabled={busy}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                title="Editar workspace"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={archive}
                disabled={busy}
                className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                title="Archivar workspace"
              >
                <Archive className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Profiles */}
        <div className="px-5 pb-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              Perfiles de acceso ({profiles.length})
            </h3>
            {isOwner && (
              <button
                type="button"
                onClick={() => setCreatingProfile(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition"
              >
                <Plus className="w-3 h-3" /> Nuevo perfil
              </button>
            )}
          </div>

          {profiles.length === 0 ? (
            <div className="text-center py-6 text-slate-400 dark:text-slate-500 text-sm border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
              Sin perfiles — crea uno para controlar el acceso
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {profiles.map((p) => {
                const isMine = myProfileIds.includes(p.id);
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 group"
                  >
                    <div
                      className="w-9 h-9 flex items-center justify-center text-lg rounded-lg flex-shrink-0"
                      style={{ backgroundColor: (p.color ?? "#1e3a5f") + "20" }}
                    >
                      {p.icon ?? "👤"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">
                          {p.label}
                        </span>
                        {isMine && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold">
                            TUYO
                          </span>
                        )}
                        {p.isSystem && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-bold">
                            SISTEMA
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Users className="w-3 h-3 text-slate-400" />
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">
                          {p.permissions.length} secciones
                        </span>
                      </div>
                    </div>
                    {isOwner && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          type="button"
                          onClick={() => setEditingProfile(p)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white dark:hover:bg-slate-700 transition"
                          title="Editar"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {!p.isSystem && (
                          <button
                            type="button"
                            onClick={() => deleteProfile(p.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </article>
    </>
  );
}

/* ─────────────────────────  MAIN  ───────────────────────── */

export function WorkspacesManager({
  data,
  activeWorkspaceId,
}: {
  data: Entry[];
  activeWorkspaceId: string | null;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-6">
      {creating && (
        <CreateWorkspaceModal
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); router.refresh(); }}
        />
      )}

      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Workspaces</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Cada workspace tiene sus propios datos y perfiles de acceso. Cambia entre ellos desde el menú del topbar.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 h-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold hover:opacity-90 transition flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nuevo workspace
        </button>
      </header>

      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-center">
          <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
          <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Sin workspaces</h3>
          <p className="text-sm text-slate-400 dark:text-slate-500 mb-6 max-w-xs">
            Crea tu primer workspace para organizar tu equipo y controlar el acceso por perfiles.
          </p>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-5 h-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold hover:opacity-90 transition"
          >
            <Plus className="w-4 h-4" />
            Crear workspace
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {data.map((entry) => (
            <WorkspaceCard
              key={entry.workspace.id}
              entry={entry}
              isActive={entry.workspace.id === activeWorkspaceId}
              onChange={() => router.refresh()}
            />
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-5">
        <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-1 text-sm flex items-center gap-2">
          <ChevronRight className="w-4 h-4" />
          ¿Cómo funcionan los workspaces?
        </h3>
        <ul className="text-sm text-slate-500 dark:text-slate-400 space-y-1 mt-2">
          <li>• Cada workspace tiene sus propios datos (clientes, proyectos, tareas)</li>
          <li>• Los perfiles controlan qué secciones puede ver cada persona</li>
          <li>• Cambia de workspace o perfil activo desde el selector en el topbar</li>
          <li>• Puedes invitar personas a workspaces y asignarles perfiles específicos</li>
        </ul>
      </div>
    </div>
  );
}
