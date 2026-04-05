"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Trash2, Plus, Eye, EyeOff } from "lucide-react";

type Category = {
  id: string;
  name: string;
  color: string;
  icon: string;
  isSystem: boolean;
  isHidden: boolean;
};

const PRESET_COLORS = [
  "#6366f1", "#ef4444", "#f59e0b", "#10b981",
  "#ec4899", "#64748b", "#8b5cf6", "#0ea5e9",
  "#f97316", "#14b8a6",
];

export function CategoriesSettings() {
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [newIcon, setNewIcon] = useState("📌");
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/categories");
    setCats(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), color: newColor, icon: newIcon }),
    });
    setNewName(""); setNewIcon("📌");
    await load();
    setSaving(false);
  }

  async function handleToggleHidden(cat: Category) {
    await fetch(`/api/categories/${cat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isHidden: !cat.isHidden }),
    });
    setCats((prev) => prev.map((c) => c.id === cat.id ? { ...c, isHidden: !c.isHidden } : c));
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta categoría?")) return;
    await fetch(`/api/categories/${id}`, { method: "DELETE" });
    setCats((prev) => prev.filter((c) => c.id !== id));
  }

  const system = cats.filter((c) => c.isSystem);
  const custom = cats.filter((c) => !c.isSystem);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-800">Categorías de tareas</h2>
        <p className="text-xs text-slate-500 mt-0.5">Organiza tus tareas con hasta 4 categorías por tarea. Puedes ocultar las del sistema o crear las tuyas.</p>
      </div>

      {/* Sistema */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Del sistema</p>
        <div className="space-y-1.5">
          {loading ? <p className="text-xs text-slate-400">Cargando...</p> : system.map((cat) => (
            <div key={cat.id} className={cn("flex items-center gap-3 px-3 py-2 rounded-lg border", cat.isHidden ? "bg-slate-50 border-slate-100 opacity-60" : "bg-white border-slate-100")}>
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: cat.color }}
              />
              <span className="text-sm">{cat.icon}</span>
              <span className={cn("text-sm flex-1", cat.isHidden && "line-through text-slate-400")}>{cat.name}</span>
              <button
                onClick={() => handleToggleHidden(cat)}
                className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                title={cat.isHidden ? "Mostrar" : "Ocultar"}
              >
                {cat.isHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Custom */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Personalizadas</p>
        <div className="space-y-1.5">
          {custom.length === 0 && !loading && (
            <p className="text-xs text-slate-400 italic">No tienes categorías personalizadas todavía.</p>
          )}
          {custom.map((cat) => (
            <div key={cat.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-slate-100 bg-white">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
              <span className="text-sm">{cat.icon}</span>
              <span className="text-sm flex-1">{cat.name}</span>
              <button
                onClick={() => handleDelete(cat.id)}
                className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                title="Eliminar"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Crear nueva */}
        <div className="mt-3 flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <label className="text-xs text-slate-500">Nombre</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="ej. Investigación"
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">Emoji</label>
            <input
              value={newIcon}
              onChange={(e) => setNewIcon(e.target.value)}
              maxLength={2}
              className="w-14 px-2 py-1.5 text-center text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">Color</label>
            <div className="flex gap-1 flex-wrap w-36">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  className={cn("w-5 h-5 rounded-full border-2 transition-transform hover:scale-110", newColor === c ? "border-slate-800 scale-110" : "border-transparent")}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={saving || !newName.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#162d4a] transition-colors disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar
          </button>
        </div>
      </div>
    </div>
  );
}
