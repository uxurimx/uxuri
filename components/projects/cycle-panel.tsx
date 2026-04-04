"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Zap } from "lucide-react";
import { getCycleInfo } from "@/lib/cycles";
import { cn } from "@/lib/utils";

const CYCLE_PRESETS = [
  { label: "24h",  value: 24 },
  { label: "48h",  value: 48 },
  { label: "60h",  value: 60 },
  { label: "96h",  value: 96 },
  { label: "100h", value: 100 },
  { label: "168h", value: 168 },
];

const PHASE_CONFIG = {
  none:        { emoji: "○", text: "Sin ciclo",    ring: "ring-slate-200" },
  rest:        { emoji: "🟢", text: "En reposo",   ring: "ring-emerald-200" },
  approaching: { emoji: "🟡", text: "Próximo",     ring: "ring-amber-200" },
  review:      { emoji: "🔴", text: "Revisar ya",  ring: "ring-orange-300" },
  overdue:     { emoji: "⚪", text: "Vencido",     ring: "ring-slate-200" },
};

interface CyclePanelProps {
  projectId: string;
  cycleHours: number | null;
  lastCycleAt: Date | null;
  nextCycleAt: Date | null;
  momentum: number;
}

export function CyclePanel({
  projectId,
  cycleHours,
  lastCycleAt,
  nextCycleAt,
  momentum,
}: CyclePanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [localCycle, setLocalCycle] = useState(cycleHours);
  const [localMomentum, setLocalMomentum] = useState(momentum);
  const [localNext, setLocalNext] = useState(nextCycleAt);
  const [localLast, setLocalLast] = useState(lastCycleAt);
  const [reviewed, setReviewed] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const customRef = useRef<HTMLInputElement>(null);

  const isCustom = localCycle !== null && !CYCLE_PRESETS.some(p => p.value === localCycle);

  const info = getCycleInfo(localCycle, localLast, localNext);
  const phase = PHASE_CONFIG[info.phase];

  async function handleSetCycle(hours: number | null) {
    setLocalCycle(hours);
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cycleHours: hours }),
    });
    startTransition(() => router.refresh());
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

      {/* Selector de horas */}
      <div>
        <p className="text-xs text-slate-400 mb-2">¿Con qué frecuencia revisas este proyecto?</p>
        <div className="flex flex-wrap gap-2">
          {CYCLE_PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => handleSetCycle(localCycle === p.value ? null : p.value)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                localCycle === p.value
                  ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              )}
            >
              {p.label}
            </button>
          ))}

          {/* Input libre */}
          <div className={cn(
            "flex items-center gap-1 rounded-lg border text-xs font-medium transition-all overflow-hidden",
            isCustom ? "border-[#1e3a5f] bg-[#1e3a5f]" : "border-slate-200 bg-white"
          )}>
            <input
              ref={customRef}
              type="number"
              min="1"
              max="8760"
              placeholder="…h"
              value={isCustom ? (customInput || String(localCycle)) : customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const h = parseInt(customInput);
                  if (h > 0) handleSetCycle(h);
                }
              }}
              onBlur={() => {
                const h = parseInt(customInput);
                if (h > 0) handleSetCycle(h);
                else setCustomInput("");
              }}
              className={cn(
                "w-14 px-2 py-1.5 bg-transparent outline-none text-xs",
                isCustom ? "text-white placeholder-blue-300" : "text-slate-600 placeholder-slate-400"
              )}
            />
            {customInput && (
              <span className={cn("pr-2 text-xs", isCustom ? "text-blue-200" : "text-slate-400")}>h</span>
            )}
          </div>
        </div>
        {isCustom && (
          <p className="text-xs text-slate-400 mt-1.5">Ciclo personalizado: cada {localCycle}h</p>
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
