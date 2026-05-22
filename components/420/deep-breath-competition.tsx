"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Wind, Flame, Trophy } from "lucide-react";

export interface BreathRecord {
  id: string;
  durationSeconds: number;
  breathType: string | null;
  tripDetails: string | null;
  tripDurationSeconds: number | null;
  date: string;
  createdAt: string;
  sessionId: string | null;
}

interface BreathStats {
  breaths: BreathRecord[];
  byDate: Record<string, { best: number; count: number }>;
  todayBest: number;
  todayCount: number;
  allTimeBest: number;
  streak: number;
}

export interface TripFormProps {
  breath: BreathRecord;
  color: string;
  onSave: (id: string, data: { tripDurationSeconds?: number; tripDetails?: string }) => void;
  onClose: () => void;
}

export function TripForm({ breath, color, onSave, onClose }: TripFormProps) {
  const [tripSecs, setTripSecs] = useState("");
  const [details, setDetails] = useState(breath.tripDetails ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const data: { tripDurationSeconds?: number; tripDetails?: string } = {};
    if (tripSecs) data.tripDurationSeconds = Number(tripSecs);
    if (details.trim()) data.tripDetails = details.trim();
    await onSave(breath.id, data);
    setSaving(false);
    onClose();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-bold text-white text-base">Cerrar viaje</p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
            Respiración de {breath.durationSeconds}s — añade los detalles del trip
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.08)" }}
        >
          <X className="w-4 h-4 text-white/50" />
        </button>
      </div>

      <div>
        <label className="text-[10px] font-semibold uppercase tracking-widest block mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
          ¿Cuánto duró el viaje? (segundos)
        </label>
        <input
          type="number"
          value={tripSecs}
          onChange={(e) => setTripSecs(e.target.value)}
          placeholder="ej. 120"
          className="w-full py-2.5 px-3 rounded-xl text-white placeholder-white/20 outline-none text-sm"
          style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${color}30` }}
        />
      </div>

      <div>
        <label className="text-[10px] font-semibold uppercase tracking-widest block mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
          Descripción del viaje
        </label>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="¿Qué pasó? ¿Qué viste, sentiste, pensaste?"
          rows={4}
          className="w-full py-2.5 px-3 rounded-xl text-white placeholder-white/20 outline-none text-sm resize-none"
          style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${color}30` }}
        />
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full py-3 rounded-2xl font-bold text-sm transition-all active:scale-95 disabled:opacity-60"
        style={{ background: color, color: "#020a06" }}
      >
        {saving ? "Guardando..." : "Guardar viaje"}
      </button>
    </div>
  );
}

interface Props {
  color: string;
  refreshKey?: number;
  soundUnlockMinBreaths?: number;
  soundUnlockMinSecs?: number;
  onSoundUnlocked?: () => void;
}

export function DeepBreathCompetition({ color, refreshKey = 0, soundUnlockMinBreaths = 3, soundUnlockMinSecs = 40, onSoundUnlocked }: Props) {
  const [stats, setStats] = useState<BreathStats | null>(null);
  const [open, setOpen] = useState(false);
  const [tripBreath, setTripBreath] = useState<BreathRecord | null>(null);
  const [notifiedUnlock, setNotifiedUnlock] = useState(false);

  useEffect(() => {
    fetch("/api/420/deep-breaths")
      .then((r) => r.json())
      .then((data) => setStats(data))
      .catch(() => {});
  }, [open, refreshKey]);

  const soundUnlocked = stats
    ? stats.todayCount >= soundUnlockMinBreaths && stats.todayBest >= soundUnlockMinSecs
    : false;

  useEffect(() => {
    if (soundUnlocked && !notifiedUnlock) {
      setNotifiedUnlock(true);
      onSoundUnlocked?.();
    }
  }, [soundUnlocked, notifiedUnlock, onSoundUnlocked]);

  async function saveTripDetails(id: string, data: { tripDurationSeconds?: number; tripDetails?: string }) {
    await fetch(`/api/420/deep-breaths/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    // Refresh
    const res = await fetch("/api/420/deep-breaths");
    if (res.ok) setStats(await res.json());
  }

  if (!stats) return null;

  const today = stats.byDate[new Date().toISOString().slice(0, 10)];

  return (
    <>
      {/* Compact strip — always visible in active session */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2.5 px-4 py-2 rounded-xl w-full transition-all active:scale-[0.98]"
        style={{
          background: soundUnlocked ? `${color}12` : "rgba(255,255,255,0.04)",
          border: `1px solid ${soundUnlocked ? color + "30" : "rgba(255,255,255,0.07)"}`,
          touchAction: "manipulation",
        }}
      >
        <Wind className="w-4 h-4 shrink-0" style={{ color: soundUnlocked ? color : "rgba(255,255,255,0.25)" }} />
        <div className="flex-1 min-w-0">
          {stats.todayCount === 0 ? (
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.28)" }}>
              Sin respiraciones hoy — arrastra el círculo hacia abajo
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold" style={{ color }}>
                Mejor hoy: {stats.todayBest}s
              </span>
              {stats.streak > 1 && (
                <span className="flex items-center gap-0.5 text-[10px]" style={{ color: "rgba(255,200,80,0.8)" }}>
                  <Flame className="w-3 h-3" /> {stats.streak}
                </span>
              )}
              {soundUnlocked && (
                <span className="text-[10px] font-semibold" style={{ color }}>♫ desbloqueado</span>
              )}
            </div>
          )}
        </div>
        {stats.allTimeBest > 0 && (
          <div className="flex items-center gap-1 shrink-0">
            <Trophy className="w-3 h-3" style={{ color: "rgba(255,200,80,0.6)" }} />
            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>{stats.allTimeBest}s</span>
          </div>
        )}
      </button>

      {/* Detail sheet */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] bg-black/60"
              onClick={() => { setOpen(false); setTripBreath(null); }}
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 360 }}
              className="fixed bottom-0 left-0 right-0 z-[71] rounded-t-3xl flex flex-col"
              style={{ background: "#070e0a", maxHeight: "88dvh" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>

              <div className="flex-1 overflow-y-auto px-5 pb-10 pt-3">
                {tripBreath ? (
                  <TripForm
                    breath={tripBreath}
                    color={color}
                    onSave={saveTripDetails}
                    onClose={() => setTripBreath(null)}
                  />
                ) : (
                  <>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <h3 className="font-bold text-white text-base">Respiraciones profundas</h3>
                        {stats.streak > 0 && (
                          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                            <Flame className="w-3 h-3 inline mr-0.5" style={{ color: "#fbbf24" }} />
                            {stats.streak} {stats.streak === 1 ? "día" : "días"} de racha
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => setOpen(false)}
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ background: "rgba(255,255,255,0.08)" }}
                      >
                        <X className="w-4 h-4 text-white/50" />
                      </button>
                    </div>

                    {/* Sound unlock progress */}
                    <div
                      className="rounded-xl p-3 mb-5"
                      style={{
                        background: soundUnlocked ? `${color}12` : "rgba(255,255,255,0.04)",
                        border: `1px solid ${soundUnlocked ? color + "35" : "rgba(255,255,255,0.08)"}`,
                      }}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>
                        {soundUnlocked ? "♫ Latido desbloqueado" : "Desbloquear latido"}
                      </p>
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                              Respiraciones hoy
                            </span>
                            <span className="text-[10px] font-bold" style={{ color }}>
                              {stats.todayCount}/{soundUnlockMinBreaths}
                            </span>
                          </div>
                          <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, (stats.todayCount / soundUnlockMinBreaths) * 100)}%`,
                                background: color,
                              }}
                            />
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                              Mejor hoy
                            </span>
                            <span className="text-[10px] font-bold" style={{ color }}>
                              {stats.todayBest}s/{soundUnlockMinSecs}s
                            </span>
                          </div>
                          <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, (stats.todayBest / soundUnlockMinSecs) * 100)}%`,
                                background: color,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Today's breaths + records */}
                    {stats.breaths.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-3xl mb-2">🫁</p>
                        <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
                          Arrastra el círculo hacia abajo para tu primera respiración profunda
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {stats.breaths.slice(0, 30).map((b) => (
                          <div
                            key={b.id}
                            className="rounded-xl px-4 py-3"
                            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="font-black text-base" style={{ color }}>{b.durationSeconds}s</span>
                                {b.breathType === "inhale_hold" && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: `${color}20`, color }}>sostén</span>
                                )}
                                {b.durationSeconds === stats.allTimeBest && (
                                  <Trophy className="w-3.5 h-3.5" style={{ color: "#fbbf24" }} />
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                                  {new Date(b.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                                </span>
                                {!b.tripDetails && (
                                  <button
                                    onClick={() => setTripBreath(b)}
                                    className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                                    style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}
                                  >
                                    cerrar viaje
                                  </button>
                                )}
                              </div>
                            </div>
                            {b.tripDetails && (
                              <p className="text-xs mt-1 leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                                ☯ {b.tripDetails}
                                {b.tripDurationSeconds && (
                                  <span style={{ color: "rgba(255,255,255,0.3)" }}> · {b.tripDurationSeconds}s de viaje</span>
                                )}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
