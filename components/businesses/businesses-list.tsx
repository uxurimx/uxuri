"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Pencil, Trash2, X, Globe, Users, Building2,
  ChevronDown, UserPlus, UserMinus,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

export type BusinessMemberRow = {
  businessId: string;
  userId: string;
  role: "owner" | "partner" | "viewer";
  userName: string | null;
  userImage: string | null;
};

export type BusinessWithMembers = {
  id: string;
  name: string;
  type: "saas" | "agency" | "product" | "service" | "household" | "personal";
  description: string | null;
  logo: string | null;
  color: string | null;
  status: "active" | "paused" | "archived";
  website: string | null;
  linkedProjectId: string | null;
  ownerId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  memberCount: number;
  members: BusinessMemberRow[];
};

type UserOption = { id: string; name: string | null; email: string | null; imageUrl: string | null };

// ── Config ───────────────────────────────────────────────────────────────────

const typeConfig: Record<BusinessWithMembers["type"], { label: string; className: string }> = {
  saas:      { label: "SaaS",     className: "bg-violet-50 text-violet-700" },
  agency:    { label: "Agencia",  className: "bg-blue-50 text-blue-700" },
  product:   { label: "Producto", className: "bg-emerald-50 text-emerald-700" },
  service:   { label: "Servicio", className: "bg-amber-50 text-amber-700" },
  household: { label: "Hogar",    className: "bg-rose-50 text-rose-700" },
  personal:  { label: "Personal", className: "bg-slate-100 text-slate-600" },
};

const statusConfig: Record<BusinessWithMembers["status"], { label: string; dot: string }> = {
  active:   { label: "Activo",    dot: "bg-emerald-400" },
  paused:   { label: "Pausado",   dot: "bg-amber-400" },
  archived: { label: "Archivado", dot: "bg-slate-300" },
};

const roleConfig: Record<BusinessMemberRow["role"], string> = {
  owner:   "Propietario",
  partner: "Socio",
  viewer:  "Lector",
};

const LOGOS = ["🏢", "🚀", "💻", "🏠", "🎯", "⚡", "🔧", "💡", "🎨", "🌐", "📱", "🛒", "🤖", "🎪", "💰", "🔬"];
const COLORS = [
  { value: "#1e3a5f", label: "Azul" },
  { value: "#7c3aed", label: "Violeta" },
  { value: "#059669", label: "Esmeralda" },
  { value: "#d97706", label: "Ámbar" },
  { value: "#dc2626", label: "Rojo" },
  { value: "#0891b2", label: "Cian" },
  { value: "#be185d", label: "Rosa" },
  { value: "#374151", label: "Gris" },
  { value: "#9333ea", label: "Púrpura" },
  { value: "#0d9488", label: "Verde" },
];

// ── Business Card ─────────────────────────────────────────────────────────────

function BusinessCard({
  biz,
  currentUserId,
  onEdit,
  onDelete,
}: {
  biz: BusinessWithMembers;
  currentUserId: string;
  onEdit: (b: BusinessWithMembers) => void;
  onDelete: (id: string) => void;
}) {
  const isOwner = biz.ownerId === currentUserId;
  const typeCfg = typeConfig[biz.type];
  const statusCfg = statusConfig[biz.status];

  return (
    <div className="group relative bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
          style={{ backgroundColor: biz.color + "22" }}
        >
          {biz.logo || "🏢"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-900 truncate">{biz.name}</h3>
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", typeCfg.className)}>
              {typeCfg.label}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={cn("w-1.5 h-1.5 rounded-full", statusCfg.dot)} />
            <span className="text-xs text-slate-500">{statusCfg.label}</span>
          </div>
        </div>
        {/* Actions (visible on hover, always visible on mobile) */}
        {isOwner && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit(biz)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(biz.id)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Description */}
      {biz.description && (
        <p className="text-xs text-slate-500 line-clamp-2">{biz.description}</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-50 mt-auto">
        {/* Members avatars */}
        <div className="flex items-center gap-1.5">
          <div className="flex -space-x-1.5">
            {/* Owner dot */}
            <div className="w-6 h-6 rounded-full bg-[#1e3a5f] flex items-center justify-center text-white text-[10px] font-bold ring-2 ring-white">
              T
            </div>
            {biz.members.slice(0, 3).map((m) => (
              <div
                key={m.userId}
                className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-[10px] font-bold ring-2 ring-white overflow-hidden"
              >
                {m.userImage ? (
                  <img src={m.userImage} alt={m.userName ?? ""} className="w-full h-full object-cover" />
                ) : (
                  (m.userName?.[0] ?? "?").toUpperCase()
                )}
              </div>
            ))}
          </div>
          <span className="text-xs text-slate-400">
            {1 + biz.memberCount} {1 + biz.memberCount === 1 ? "persona" : "personas"}
          </span>
        </div>

        {/* Website */}
        {biz.website && (
          <a
            href={biz.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-slate-400 hover:text-[#1e3a5f] flex items-center gap-1"
          >
            <Globe className="w-3 h-3" />
            web
          </a>
        )}
      </div>
    </div>
  );
}

// ── Business Modal ────────────────────────────────────────────────────────────

function BusinessModal({
  biz,
  allUsers,
  currentUserId,
  onClose,
  onSaved,
}: {
  biz: BusinessWithMembers | null; // null = create
  allUsers: UserOption[];
  currentUserId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!biz;
  const [name, setName] = useState(biz?.name ?? "");
  const [type, setType] = useState<BusinessWithMembers["type"]>(biz?.type ?? "service");
  const [description, setDescription] = useState(biz?.description ?? "");
  const [logo, setLogo] = useState(biz?.logo ?? "🏢");
  const [color, setColor] = useState(biz?.color ?? "#1e3a5f");
  const [status, setStatus] = useState<BusinessWithMembers["status"]>(biz?.status ?? "active");
  const [website, setWebsite] = useState(biz?.website ?? "");
  const [saving, setSaving] = useState(false);

  // Members state
  const [members, setMembers] = useState<BusinessMemberRow[]>(biz?.members ?? []);
  const [addUserId, setAddUserId] = useState("");
  const [addRole, setAddRole] = useState<BusinessMemberRow["role"]>("partner");
  const [addingMember, setAddingMember] = useState(false);
  const [showTeam, setShowTeam] = useState(false);

  const availableUsers = allUsers.filter(
    (u) => u.id !== currentUserId && !members.some((m) => m.userId === u.id)
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        type,
        description: description.trim() || null,
        logo,
        color,
        status,
        website: website.trim() || null,
      };
      const res = isEdit
        ? await fetch(`/api/businesses/${biz!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/businesses", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (res.ok) onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function handleAddMember() {
    if (!biz || !addUserId) return;
    setAddingMember(true);
    try {
      const res = await fetch(`/api/businesses/${biz.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: addUserId, role: addRole }),
      });
      if (res.ok) {
        const user = allUsers.find((u) => u.id === addUserId);
        setMembers((prev) => [
          ...prev,
          {
            businessId: biz.id,
            userId: addUserId,
            role: addRole,
            userName: user?.name ?? null,
            userImage: user?.imageUrl ?? null,
          },
        ]);
        setAddUserId("");
      }
    } finally {
      setAddingMember(false);
    }
  }

  async function handleRemoveMember(memberId: string, memberUserId: string) {
    if (!biz) return;
    // Find the member record ID
    const res = await fetch(`/api/businesses/${biz.id}/members`);
    const fullMembers = await res.json();
    const record = fullMembers.find((m: { userId: string; id: string }) => m.userId === memberUserId);
    if (!record) return;
    await fetch(`/api/businesses/${biz.id}/members/${record.id}`, { method: "DELETE" });
    setMembers((prev) => prev.filter((m) => m.userId !== memberUserId));
  }

  async function handleChangeRole(memberUserId: string, newRole: BusinessMemberRow["role"]) {
    if (!biz) return;
    const res = await fetch(`/api/businesses/${biz.id}/members`);
    const fullMembers = await res.json();
    const record = fullMembers.find((m: { userId: string; id: string }) => m.userId === memberUserId);
    if (!record) return;
    await fetch(`/api/businesses/${biz.id}/members/${record.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    setMembers((prev) => prev.map((m) => (m.userId === memberUserId ? { ...m, role: newRole } : m)));
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">
            {isEdit ? "Editar negocio" : "Nuevo negocio"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Logo + Color */}
          <div className="flex gap-4 items-start">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Logo</label>
              <div className="flex flex-wrap gap-1.5 max-w-[160px]">
                {LOGOS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLogo(l)}
                    className={cn(
                      "w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-colors",
                      logo === l ? "bg-[#1e3a5f]/10 ring-2 ring-[#1e3a5f]" : "hover:bg-slate-50"
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Color</label>
              <div className="flex flex-wrap gap-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    title={c.label}
                    className={cn(
                      "w-6 h-6 rounded-full transition-transform",
                      color === c.value ? "scale-125 ring-2 ring-offset-1 ring-slate-400" : "hover:scale-110"
                    )}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>

              {/* Preview */}
              <div
                className="mt-3 w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{ backgroundColor: color + "22" }}
              >
                {logo}
              </div>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Tekton, YUMM, HOGAR..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
              required
            />
          </div>

          {/* Type + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as BusinessWithMembers["type"])}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
              >
                <option value="saas">SaaS</option>
                <option value="agency">Agencia</option>
                <option value="product">Producto</option>
                <option value="service">Servicio</option>
                <option value="household">Hogar</option>
                <option value="personal">Personal</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as BusinessWithMembers["status"])}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
              >
                <option value="active">Activo</option>
                <option value="paused">Pausado</option>
                <option value="archived">Archivado</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 resize-none"
            />
          </div>

          {/* Website */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Sitio web</label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
            />
          </div>

          {/* Team section — only when editing */}
          {isEdit && (
            <div className="border border-slate-100 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowTeam((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-400" />
                  Equipo ({1 + members.length})
                </div>
                <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", showTeam && "rotate-180")} />
              </button>

              {showTeam && (
                <div className="px-4 pb-4 space-y-3 border-t border-slate-100">
                  {/* Owner (read-only) */}
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#1e3a5f] flex items-center justify-center text-white text-xs font-bold">
                        T
                      </div>
                      <span className="text-sm text-slate-700">Tú (propietario)</span>
                    </div>
                    <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
                      Propietario
                    </span>
                  </div>

                  {/* Members */}
                  {members.map((m) => (
                    <div key={m.userId} className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 overflow-hidden">
                          {m.userImage ? (
                            <img src={m.userImage} alt={m.userName ?? ""} className="w-full h-full object-cover" />
                          ) : (
                            (m.userName?.[0] ?? "?").toUpperCase()
                          )}
                        </div>
                        <span className="text-sm text-slate-700">{m.userName ?? m.userId}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={m.role}
                          onChange={(e) => handleChangeRole(m.userId, e.target.value as BusinessMemberRow["role"])}
                          className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none"
                        >
                          <option value="owner">Propietario</option>
                          <option value="partner">Socio</option>
                          <option value="viewer">Lector</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(m.businessId, m.userId)}
                          className="p-1 text-slate-400 hover:text-red-500 rounded"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Add member */}
                  {availableUsers.length > 0 && (
                    <div className="flex gap-2 pt-2 border-t border-slate-50">
                      <select
                        value={addUserId}
                        onChange={(e) => setAddUserId(e.target.value)}
                        className="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none min-w-0"
                      >
                        <option value="">Seleccionar usuario...</option>
                        {availableUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name ?? u.email}
                          </option>
                        ))}
                      </select>
                      <select
                        value={addRole}
                        onChange={(e) => setAddRole(e.target.value as BusinessMemberRow["role"])}
                        className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none"
                      >
                        <option value="partner">Socio</option>
                        <option value="viewer">Lector</option>
                        <option value="owner">Propietario</option>
                      </select>
                      <button
                        type="button"
                        disabled={!addUserId || addingMember}
                        onClick={handleAddMember}
                        className="px-3 py-1.5 bg-[#1e3a5f] text-white text-sm rounded-lg disabled:opacity-40 hover:bg-[#162d4a] transition-colors"
                      >
                        <UserPlus className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex-1 px-4 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#162d4a] transition-colors disabled:opacity-50"
            >
              {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear negocio"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main List ─────────────────────────────────────────────────────────────────

export function BusinessesList({
  initialBusinesses,
  currentUserId,
  allUsers,
}: {
  initialBusinesses: BusinessWithMembers[];
  currentUserId: string;
  allUsers: UserOption[];
}) {
  const router = useRouter();
  const [businesses, setBusinesses] = useState(initialBusinesses);
  const [modalBiz, setModalBiz] = useState<BusinessWithMembers | null | undefined>(undefined);
  // undefined = closed, null = create mode, BusinessWithMembers = edit mode

  function openCreate() { setModalBiz(null); }
  function openEdit(b: BusinessWithMembers) { setModalBiz(b); }
  function closeModal() { setModalBiz(undefined); }

  function handleSaved() {
    closeModal();
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este negocio? Los proyectos y clientes vinculados perderán la referencia.")) return;
    await fetch(`/api/businesses/${id}`, { method: "DELETE" });
    setBusinesses((prev) => prev.filter((b) => b.id !== id));
  }

  const activeCount = businesses.filter((b) => b.status === "active").length;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Negocios</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {activeCount} activo{activeCount !== 1 ? "s" : ""} · {businesses.length} en total
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-[#1e3a5f] text-white rounded-xl text-sm font-medium hover:bg-[#162d4a] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo negocio
        </button>
      </div>

      {/* Grid */}
      {businesses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Building2 className="w-12 h-12 text-slate-200 mb-4" />
          <p className="text-slate-500 font-medium">Sin negocios todavía</p>
          <p className="text-slate-400 text-sm mt-1">
            Crea tu primer negocio para organizar proyectos y clientes por empresa
          </p>
          <button
            onClick={openCreate}
            className="mt-4 px-4 py-2 bg-[#1e3a5f] text-white rounded-xl text-sm font-medium hover:bg-[#162d4a] transition-colors"
          >
            Crear negocio
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {businesses.map((b) => (
            <BusinessCard
              key={b.id}
              biz={b}
              currentUserId={currentUserId}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {modalBiz !== undefined && (
        <BusinessModal
          biz={modalBiz}
          allUsers={allUsers}
          currentUserId={currentUserId}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
