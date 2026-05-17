"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, Sparkles, Star } from "lucide-react";
import type { SmokeSession } from "@/db/schema";
import { SessionCurve, type CurveCheckin } from "./session-curve";

function formatDuration(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

const DIMENSIONS = [
  { key: "relaxRating",      emoji: "😌", label: "Relax",        desc: "¿Qué tan relajado te sentiste?" },
  { key: "creativityRating", emoji: "🎨", label: "Creatividad",  desc: "¿Fluyeron las ideas?" },
  { key: "focusRating",      emoji: "🎯", label: "Focus",        desc: "¿Pudiste concentrarte?" },
  { key: "euphoriaRating",   emoji: "🔥", label: "Euforia",      desc: "¿Cuánto hype sentiste?" },
  { key: "depthRating",      emoji: "🌊", label: "Profundidad",  desc: "¿Qué tan profundo fue?" },
];

const MOOD_EMOJIS = ["", "😴", "😑", "😐", "🙂", "😊", "😄", "🤩", "🚀", "🌟", "🔥"];

interface Ratings {
  relaxRating: number;
  creativityRating: number;
  focusRating: number;
  euphoriaRating: number;
  depthRating: number;
}

interface Props {
  session: SmokeSession;
  elapsedSeconds: number;
  color: string;
  onDone: () => void;
  onCancel: () => void;
}

export function SessionCloseFlow({ session, elapsedSeconds, color, onDone, onCancel }: Props) {
  const [step, setStep] = useState(0);
  const [checkins, setCheckins] = useState<CurveCheckin[]>([]);
  const [ratings, setRatings] = useState<Ratings>({
    relaxRating: 5, creativityRating: 5, focusRating: 5, euphoriaRating: 5, depthRating: 5,
  });
  const [moodAfter, setMoodAfter] = useState(7);
  const [summary, setSummary] = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const overallRating = Math.round(
    Object.values(ratings).reduce((a, b) => a + b, 0) / Object.values(ratings).length
  );

  useEffect(() => {
    fetch(`/api/420/sessions/${session.id}`)
      .then((r) => r.json())
      .then(({ checkins }) => setCheckins(checkins ?? []));
  }, [session.id]);

  async function handleClose(withAI: boolean) {
    setSaving(true);
    try {
      await fetch(`/api/420/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "closed",
          ...ratings,
          moodAfter,
          overallRating,
          summary: summary || null,
          generateAI: withAI,
        }),
      });
      onDone();
    } finally {
      setSaving(false);
    }
  }

  async function generateAI() {
    setAiLoading(true);
    try {
      const res = await fetch(`/api/420/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "closed",
          ...ratings,
          moodAfter,
          overallRating,
          summary: summary || null,
          generateAI: true,
        }),
      });
      const data = await res.json();
      setAiSummary(data.aiSummary ?? "");
    } finally {
      setAiLoading(false);
    }
  }

  const steps = [
    {
      title: "Tu curva",
      subtitle: `Duración: ${formatDuration(elapsedSeconds)}`,
      content: (
        <div>
          <div
            className="rounded-2xl p-4 mb-4"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <SessionCurve checkins={checkins} color={color} height={160} />
          </div>
          {checkins.length === 0 && (
            <p className="text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
              No marcaste momentos — ¡la próxima vez prueba los check-ins!
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="rounded-xl p-3 text-center" style={{ background: `${color}12` }}>
              <p className="text-xl font-black" style={{ color }}>{formatDuration(elapsedSeconds)}</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Duración</p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{ background: `${color}12` }}>
              <p className="text-xl font-black" style={{ color }}>{checkins.length}</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Momentos</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "¿Cómo fue?",
      subtitle: "Rating de la experiencia",
      content: (
        <div className="space-y-5">
          {DIMENSIONS.map((dim) => {
            const val = ratings[dim.key as keyof Ratings];
            return (
              <div key={dim.key}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-lg mr-2">{dim.emoji}</span>
                    <span className="text-white font-semibold text-sm">{dim.label}</span>
                    <p className="text-xs ml-[1.75rem]" style={{ color: "rgba(255,255,255,0.3)" }}>{dim.desc}</p>
                  </div>
                  <span className="text-xl font-black" style={{ color }}>{val}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={val}
                  onChange={(e) =>
                    setRatings((r) => ({ ...r, [dim.key]: Number(e.target.value) }))
                  }
                  className="w-full"
                  style={{ accentColor: color }}
                />
              </div>
            );
          })}

          {/* Overall */}
          <div
            className="rounded-2xl p-4 text-center"
            style={{ background: `${color}15`, border: `1px solid ${color}40` }}
          >
            <div className="flex items-center justify-center gap-1 mb-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  className="w-4 h-4"
                  fill={i <= Math.round(overallRating / 2) ? color : "transparent"}
                  style={{ color }}
                />
              ))}
            </div>
            <p className="text-white font-bold">Promedio: {overallRating}/10</p>
          </div>
        </div>
      ),
    },
    {
      title: "Reflexión",
      subtitle: "Cierra el ciclo",
      content: (
        <div className="space-y-5">
          {/* Mood after */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-white font-semibold text-sm">Estado de ánimo ahora</p>
              <span className="text-2xl">{MOOD_EMOJIS[moodAfter]}</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={moodAfter}
              onChange={(e) => setMoodAfter(Number(e.target.value))}
              className="w-full mb-1"
              style={{ accentColor: color }}
            />
            <div className="flex justify-between text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
              <span>Bajo</span><span>Neutro</span><span>Excelente</span>
            </div>
          </div>

          {/* Summary */}
          <div>
            <p className="text-white font-semibold text-sm mb-2">¿Qué descubriste? ¿Pensamientos clave?</p>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={5}
              placeholder="Libre... qué ideas, conexiones, revelaciones, tareas, sensaciones..."
              className="w-full rounded-2xl p-4 text-white placeholder-white/25 outline-none resize-none text-sm leading-relaxed"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            />
          </div>

          {/* Close without AI */}
          <button
            onClick={() => handleClose(false)}
            disabled={saving}
            className="w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-95 disabled:opacity-50"
            style={{ background: color, color: "#020a06" }}
          >
            {saving ? "Cerrando..." : "Cerrar sesión ✓"}
          </button>

          {/* Go to AI step */}
          <button
            onClick={() => setStep(3)}
            className="w-full py-3 rounded-xl text-sm font-medium"
            style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)" }}
          >
            <Sparkles className="w-4 h-4 inline mr-2" />
            Ver análisis AI primero
          </button>
        </div>
      ),
    },
    {
      title: "Insights AI",
      subtitle: "Tu sesión analizada",
      content: (
        <div className="space-y-4">
          {!aiSummary && !aiLoading && (
            <div className="text-center py-6">
              <Sparkles className="w-10 h-10 mx-auto mb-4" style={{ color }} />
              <p className="text-white font-semibold mb-2">Analizar con AI</p>
              <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.4)" }}>
                La IA analizará tus notas, check-ins y reflexiones para entregarte 3 insights concisos.
              </p>
              <button
                onClick={generateAI}
                className="px-8 py-3 rounded-2xl font-bold text-sm transition-all active:scale-95"
                style={{ background: `${color}22`, border: `1px solid ${color}50`, color }}
              >
                Generar análisis
              </button>
            </div>
          )}

          {aiLoading && (
            <div className="text-center py-10">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-10 h-10 rounded-full border-2 border-t-transparent mx-auto mb-4"
                style={{ borderColor: `${color}50`, borderTopColor: color }}
              />
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Analizando tu sesión...</p>
            </div>
          )}

          {aiSummary && (
            <div
              className="rounded-2xl p-5"
              style={{ background: `${color}10`, border: `1px solid ${color}30` }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4" style={{ color }} />
                <p className="font-bold text-white text-sm">Tu sesión en pocas palabras</p>
              </div>
              <div className="space-y-3">
                {aiSummary.split("\n").filter(Boolean).map((line, i) => (
                  <p key={i} className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.8)" }}>
                    {line}
                  </p>
                ))}
              </div>
            </div>
          )}

          {aiSummary && (
            <button
              onClick={onDone}
              disabled={saving}
              className="w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-95 disabled:opacity-50"
              style={{ background: color, color: "#020a06" }}
            >
              Cerrar sesión ✓
            </button>
          )}
        </div>
      ),
    },
  ];

  const currentStep = steps[step];
  const TOTAL = 3;

  return (
    <motion.div
      initial={{ opacity: 0, y: 60 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 60 }}
      className="fixed inset-0 z-[55] flex flex-col"
      style={{ background: "#07090f" }}
    >
      {/* Progress dots */}
      <div className="flex items-center justify-between px-5 pt-safe-top pt-5 pb-4">
        <button
          onClick={step === 0 ? onCancel : () => setStep((s) => s - 1)}
          className="p-2 rounded-full"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <ChevronLeft className="w-5 h-5 text-white/50" />
        </button>

        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-full transition-all"
              style={{
                width: step === i ? 24 : 8,
                height: 8,
                background: step >= i ? color : "rgba(255,255,255,0.15)",
              }}
            />
          ))}
        </div>

        <div className="w-9" />
      </div>

      {/* Step header */}
      <div className="px-5 mb-5">
        <h2 className="text-white font-black text-2xl">{currentStep.title}</h2>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>{currentStep.subtitle}</p>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {currentStep.content}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Next button (only for non-last steps) */}
      {step < 2 && (
        <div className="px-5 pb-8">
          <button
            onClick={() => setStep((s) => s + 1)}
            className="w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-95"
            style={{ background: `${color}20`, border: `1px solid ${color}40`, color }}
          >
            Siguiente
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </motion.div>
  );
}
