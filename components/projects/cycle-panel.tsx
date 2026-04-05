"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Zap, Plus, X } from "lucide-react";
import { getCycleInfo, formatDuration } from "@/lib/cycles";
import { cn } from "@/lib/utils";

type CyclePreset = {
  id: string;
  label: string;
  minutes: number;
  isSystem: boolean;
  isHidden: boolean;
};

const PHASE_CONFIG = {
  none:        { emoji: "○", text: "Sin ciclo",    ring: "ring-slate-200" },
  rest:        { emoji: "🟢", text: "En reposo",   ring: "ring-emerald-200" },
  approaching: { emoji: "🟡", text: "Próximo",     ring: "ring-amber-200" },
  review:      { emoji: "🔴", text: "Revisar ya",  ring: "ring-orange-300" },
  overdue:     { emoji: "⚪", text: "Vencido",     ring: "ring-slate-200" },
};

interface CyclePanelProps {
  projectId: string;
  cycleMinutes: number | null;
  lastCycleAt: Date | null;
  nextCycleAt: Date | null;
  momentum: number;
}

export function CyclePanel({
  projectId,
  cycleMinutes,
  lastCycleAt,
  nextCycleAt,
  momentum,
}: CyclePanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [localCycle, setLocalCycle] = useState(cycleMinutes);
  const [localMomentum, setLocalMomentum] = useState(momentum);
  const [localNext, setLocalNext] = useState(nextCycleAt);
  const [localLast, setLocalLast] = useState(lastCycleAt);
  const [reviewed, setReviewed] = useState(false);

  const [presets, setPresets] = useState<CyclePreset[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [customUnit, setCustomUnit] = useState<"min" | "h" | "d">("h");
  const [showCustom, setShowCustom] = useState(false);

  useEffect(() => {
    fetch("/api/cycle-presets")
      .then((r) => r.json())
      .then((data: CyclePreset[]) => setPresets(data.filter((p) => !p.isHidden)));
  }, []);

  const info = getCycleInfo(localCycle, localLast, localNext);
  const phase = PHASE_CONFIG[info.phase];

  async function handleSetCycle(minutes: number | null) {
    setLocalCycle(minutes);
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cycleMinutes: minutes }),
    });
    startTransition(() => router.refresh());
  }

  async function handleCustomSubmit() {
    const val = parseInt(customInput, 10);
    if (!val || val <= 0) return;
    const multiplier = customUnit === "min" ? 1 : customUnit === "h" ? 60 : 1440;
    const minutes = val * multiplier;
    setShowCustom(false);
    setCustomInput("");
    await handleSetCycle(minutes);
  }

  async function handleReview() {
    const res = await fetch(`/api/projects/${projectId}/review`, { method: "POST" });
    if (!res.ok) return;
    const data = await res.json();
    setLocalLast(data.lastCycleAt ? new Date(data.lastCycleAt) : null);
    setLocalNext(data.nextCycleAt ? new Date(data.nextCycleAt) : null);
    setLocalMomentum(data.momentum);
    setReviewed(true);
    setTimeout(() => setReviewed(false), 2500);
    startTransition(() => router.refresh());
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">Ciclo de revisión</span>
        </div>
        {localCycle && (
          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", info.badgeClass)}>
            {phase.emoji} {info.label || phase.text}
          </span>
        )}
      </div>

      {/* Presets */}
      <div>
        <p className="text-xs text-slate-400 mb-2">¿Con qué frecuencia revisas este proyecto?</p>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => handleSetCycle(localCycle === p.minutes ? null : p.minutes)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                localCycle === p.minutes
                  ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              )}
            >
              {p.label}
            </button>
          ))}

          {/* Botón personalizado */}
          {!showCustom ? (
            <button
              onClick={() => setShowCustom(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-dashed border-slate-300 text-slate-500 hover:border-slate-400 hover:bg-slate-50 transition-all"
            >
              <Plus className="w-3 h-3" />
              Personalizado
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                type="number"
                min={1}
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCustomSubmit(); if (e.key === "Escape") setShowCustom(false); }}
                placeholder="ej. 5"
                className="w-16 px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
              />
              <select
                value={customUnit}
                onChange={(e) => setCustomUnit(e.target.value as "min" | "h" | "d")}
                className="text-xs border border-slate-200 rounded-lg px-1.5 py-1 focus:outline-none"
              >
                <option value="min">min</option>
                <option value="h">h</option>
                <option value="d">días</option>
              </select>
              <button
                onClick={handleCustomSubmit}
                className="px-2 py-1 bg-[#1e3a5f] text-white rounded-lg text-xs font-medium hover:bg-[#16305a] transition-colors"
              >
                ✓
              </button>
              <button onClick={() => setShowCustom(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Ciclo actual personalizado (si no está en presets) */}
        {localCycle && !presets.some((p) => p.minutes === localCycle) && (
          <p className="text-xs text-slate-400 mt-1.5">
            Ciclo activo: {formatDuration(localCycle)}
            <button
              onClick={() => handleSetCycle(null)}
              className="ml-2 text-red-400 hover:text-red-600 transition-colors"
            >
              Quitar
            </button>
          </p>
        )}
      </div>

      {localCycle && (
        <>
          {/* Barra de fase */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Fase del ciclo</span>
              <span className="font-medium">{Math.min(info.pct, 100)}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-700", info.barColor)}
                style={{ width: `${Math.min(info.pct, 100)}%` }}
              />
            </div>
          </div>

          {/* Momentum */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3" />
                Momentum
              </span>
              <span className="font-medium text-slate-700">{localMomentum}%</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700",
                  localMomentum >= 70 ? "bg-emerald-400" :
                  localMomentum >= 40 ? "bg-amber-400" : "bg-red-400"
                )}
                style={{ width: `${localMomentum}%` }}
              />
            </div>
          </div>

          {/* Botón Revisé */}
          <button
            onClick={handleReview}
            disabled={isPending || reviewed}
            className={cn(
              "w-full py-2.5 rounded-xl text-sm font-semibold transition-all",
              reviewed
                ? "bg-emerald-500 text-white"
                : "bg-[#1e3a5f] hover:bg-[#16305a] text-white active:scale-[0.98]"
            )}
          >
            {reviewed ? "✓ Ciclo reiniciado" : "✓ Revisé este proyecto"}
          </button>
        </>
      )}

      {!localCycle && (
        <p className="text-xs text-slate-400 text-center py-1">
          Sin ciclo activo — elige una frecuencia arriba para activarlo
        </p>
      )}
    </div>
  );
}
