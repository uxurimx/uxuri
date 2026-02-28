"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RoleRecord } from "@/db/schema/roles";
import { SECTIONS } from "@/lib/permissions";
import { Plus, Pencil, Trash2, Check, Shield } from "lucide-react";

type FormState = {
  name: string;
  label: string;
  permissions: string[];
  isDefault: boolean;
};

const emptyForm: FormState = { name: "", label: "", permissions: ["/dashboard"], isDefault: false };

export function RolesTab({ initialRoles }: { initialRoles: RoleRecord[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RoleRecord | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(role: RoleRecord) {
    setEditing(role);
    setForm({
      name: role.name,
      label: role.label,
      permissions: role.permissions,
      isDefault: role.isDefault,
    });
    setShowForm(true);
  }

  function togglePermission(path: string) {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(path)
        ? prev.permissions.filter((p) => p !== path)
        : [...prev.permissions, path],
    }));
  }

  async function handleSave() {
    setLoading(true);
    try {
      const url = editing ? `/api/roles/${editing.id}` : "/api/roles";
      const method = editing ? "PATCH" : "POST";
      const body = editing
        ? { label: form.label, permissions: form.permissions, isDefault: form.isDefault }
        : form;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setShowForm(false);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este rol? Los usuarios con este rol quedarán sin permisos.")) return;
    setDeletingId(id);
    try {
      await fetch(`/api/roles/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Define qué secciones puede ver cada rol. Asigna roles a usuarios en la pestaña Usuarios.
        </p>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#162d4a] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo rol
        </button>
      </div>

      {/* Formulario crear/editar */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h3 className="font-semibold text-slate-900">
            {editing ? "Editar rol" : "Crear rol"}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {!editing && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nombre interno <span className="text-slate-400 text-xs">(sin espacios)</span>
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase().replace(/\s/g, "_") })}
                  placeholder="ej: supervisor"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nombre visible
              </label>
              <input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="ej: Supervisor"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Secciones accesibles
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SECTIONS.map((section) => {
                const checked = form.permissions.includes(section.path);
                return (
                  <button
                    key={section.path}
                    type="button"
                    onClick={() => togglePermission(section.path)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      checked
                        ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {checked && <Check className="w-3.5 h-3.5" />}
                    {section.label}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
              className="rounded border-slate-300 text-[#1e3a5f] focus:ring-[#1e3a5f]/20"
            />
            <span className="text-sm text-slate-700">
              Rol por defecto para nuevos usuarios
            </span>
          </label>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !form.label || (!editing && !form.name)}
              className="px-5 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#162d4a] transition-colors disabled:opacity-50"
            >
              {loading ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      )}

      {/* Lista de roles */}
      <div className="space-y-3">
        {initialRoles.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
            No hay roles creados aún
          </div>
        )}
        {initialRoles.map((role) => (
          <div
            key={role.id}
            className="bg-white rounded-xl border border-slate-200 p-4 flex items-start justify-between gap-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                <Shield className="w-4 h-4 text-slate-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900">{role.label}</span>
                  <span className="text-xs text-slate-400 font-mono">{role.name}</span>
                  {role.isDefault && (
                    <span className="text-xs bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">
                      por defecto
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {role.permissions.length === 0 ? (
                    <span className="text-xs text-slate-400">Sin acceso a secciones</span>
                  ) : (
                    role.permissions.map((p) => {
                      const section = SECTIONS.find((s) => s.path === p);
                      return (
                        <span
                          key={p}
                          className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full"
                        >
                          {section?.label ?? p}
                        </span>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => openEdit(role)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                title="Editar"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(role.id)}
                disabled={deletingId === role.id}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                title="Eliminar"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
