"use client";

import { useEffect, useState } from "react";
import { Trash2, Plus, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/cycles";

type Preset = {
  id: string;
  label: string;
  minutes: number;
  isSystem: boolean;
  isHidden: boolean;
};

export function CyclePresetsSettings() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newUnit, setNewUnit] = useState<"min" | "h" | "d">("h");
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/cycle-presets");
    setPresets(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    const val = parseInt(newValue, 10);
    if (!newLabel.trim() || !val || val <= 0) return;
    const multiplier = newUnit === "min" ? 1 : newUnit === "h" ? 60 : 1440;
    const minutes = val * multiplier;
    setSaving(true);
    await fetch("/api/cycle-presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newLabel.trim(), minutes }),
    });
    setNewLabel(""); setNewValue("");
    await load();
    setSaving(false);
  }

  async function handleToggleHidden(p: Preset) {
    await fetch(`/api/cycle-presets/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isHidden: !p.isHidden }),
    });
    setPresets((prev) => prev.map((x) => x.id === p.id ? { ...x, isHidden: !x.isHidden } : x));
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este preset?")) return;
    await fetch(`/api/cycle-presets/${id}`, { method: "DELETE" });
    setPresets((prev) => prev.filter((x) => x.id !== id));
  }

  const system = presets.filter((p) => p.isSystem);
  const custom = presets.filter((p) => !p.isSystem);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-800">Presets de ciclos de revisión</h2>
        <p className="text-xs text-slate-500 mt-0.5">Define con qué frecuencias puedes revisar proyectos. Desde 5 minutos hasta meses.</p>
      </div>

      {/* Sistema */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Del sistema</p>
        <div className="space-y-1.5">
          {loading ? <p className="text-xs text-slate-400">Cargando...</p> : system.map((p) => (
            <div key={p.id} className={cn("flex items-center gap-3 px-3 py-2 rounded-lg border", p.isHidden ? "bg-slate-50 border-slate-100 opacity-60" : "bg-white border-slate-100")}>
              <span className={cn("text-sm flex-1 font-medium", p.isHidden && "line-through text-slate-400")}>{p.label}</span>
              <span className="text-xs text-slate-400">{formatDuration(p.minutes)}</span>
              <button
                onClick={() => handleToggleHidden(p)}
                className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                title={p.isHidden ? "Mostrar" : "Ocultar"}
              >
                {p.isHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Custom */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Personalizados</p>
        <div className="space-y-1.5">
          {custom.length === 0 && !loading && (
            <p className="text-xs text-slate-400 italic">No tienes presets personalizados todavía.</p>
          )}
          {custom.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-slate-100 bg-white">
              <span className="text-sm flex-1 font-medium">{p.label}</span>
              <span className="text-xs text-slate-400">{formatDuration(p.minutes)}</span>
              <button
                onClick={() => handleDelete(p.id)}
                className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                title="Eliminar"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Crear nuevo */}
        <div className="mt-3 flex gap-2 items-end flex-wrap">
          <div className="flex-1 min-w-32 space-y-1">
            <label className="text-xs text-slate-500">Etiqueta</label>
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="ej. 2 semanas"
              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">Duración</label>
            <div className="flex gap-1">
              <input
                type="number"
                min={1}
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="ej. 14"
                className="w-20 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
              />
              <select
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value as "min" | "h" | "d")}
                className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none"
              >
                <option value="min">min</option>
                <option value="h">horas</option>
                <option value="d">días</option>
              </select>
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={saving || !newLabel.trim() || !newValue}
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
