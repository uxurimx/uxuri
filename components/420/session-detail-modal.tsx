"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lightbulb, FileText, Mic, CheckSquare, Zap, Star, Clock, Sparkles } from "lucide-react";
import { SessionCurve, type CurveCheckin } from "./session-curve";

const TYPE_EMOJIS: Record<string, string> = {
  sativa: "🌿", indica: "🌑", hybrid: "⚡", cbd: "🌸", hash: "🪨", concentrate: "💎",
};
const METHOD_LABELS: Record<string, string> = {
  joint: "Joint", pipe: "Pipe", vape: "Vape", edible: "Edible", bong: "Bong", dab: "Dab",
};
const AMOUNT_LABELS: Record<string, string> = {
  micro: "Micro", low: "Poco", medium: "Medio", heavy: "Fuerte", very_heavy: "Máximo",
};
const NOTE_TYPE_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  text:    { icon: FileText,    label: "Nota",    color: "#60a5fa" },
  insight: { icon: Lightbulb,  label: "Insight", color: "#fbbf24" },
  task:    { icon: CheckSquare, label: "Tarea",   color: "#4ade80" },
  voice:   { icon: Mic,         label: "Voz",     color: "#c084fc" },
};
const DIMENSIONS = [
  { key: "relaxRating",      emoji: "😌", label: "Relax" },
  { key: "creativityRating", emoji: "🎨", label: "Creatividad" },
  { key: "focusRating",      emoji: "🎯", label: "Focus" },
  { key: "euphoriaRating",   emoji: "🔥", label: "Euforia" },
  { key: "depthRating",      emoji: "🌊", label: "Profundidad" },
];

function formatDuration(s: number) {
  if (!s) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString("es-MX", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}
function formatTime(d: string | Date) {
  return new Date(d).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

interface Session {
  id: string;
  type: string;
  method: string;
  amount: string;
  strain: string | null;
  startedAt: string;
  endedAt?: string | null;
  elapsedSeconds: number | null;
  overallRating: number | null;
  creativityRating?: number | null;
  relaxRating?: number | null;
  focusRating?: number | null;
  euphoriaRating?: number | null;
  depthRating?: number | null;
  moodBefore?: number | null;
  moodAfter?: number | null;
  summary?: string | null;
  aiSummary?: string | null;
  status: string;
}

interface Note {
  id: string;
  content: string;
  type: string;
  tags: string[] | null;
  minutesMark: number | null;
  convertedToTask: boolean;
  createdAt: string;
}

interface Checkin {
  id: string;
  minutesMark: number;
  intensity: number;
  tags: string[] | null;
  createdAt: string;
}

interface DetailData {
  session: Session;
  notes: Note[];
  checkins: Checkin[];
}

interface Props {
  sessionId: string | null;
  color: string;
  onClose: () => void;
}

export function SessionDetailModal({ sessionId, color, onClose }: Props) {
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"notas" | "curva" | "ratings">("notas");

  useEffect(() => {
    if (!sessionId) { setData(null); return; }
    setLoading(true);
    setActiveTab("notas");
    fetch(`/api/420/sessions/${sessionId}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const open = !!sessionId;
  const s = data?.session;
  const notes = data?.notes ?? [];
  const checkins = data?.checkins ?? [];

  // Group notes by type
  const insights = notes.filter((n) => n.type === "insight");
  const regularNotes = notes.filter((n) => n.type === "text" || n.type === "voice");
  const taskNotes = notes.filter((n) => n.type === "task");

  const hasRatings = s && (s.overallRating || s.relaxRating || s.creativityRating);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl flex flex-col"
            style={{ background: "#0a0f12", maxHeight: "92dvh" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {loading && (
              <div className="flex items-center justify-center py-20">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  className="w-8 h-8 rounded-full border-2 border-t-transparent"
                  style={{ borderColor: `${color}40`, borderTopColor: color }}
                />
              </div>
            )}

            {!loading && s && (
              <>
                {/* Header */}
                <div className="px-5 pb-3 shrink-0">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <h2 className="text-white font-black text-xl">
                        {TYPE_EMOJIS[s.type]} {s.type}
                      </h2>
                      <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
                        {METHOD_LABELS[s.method]} · {AMOUNT_LABELS[s.amount]}
                        {s.strain && ` · ${s.strain}`}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                        {formatDate(s.startedAt)}
                      </p>
                    </div>
                    <button
                      onClick={onClose}
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: "rgba(255,255,255,0.08)" }}
                    >
                      <X className="w-4 h-4 text-white/60" />
                    </button>
                  </div>

                  {/* Quick stats row */}
                  <div className="flex gap-2 mt-3">
                    <div
                      className="flex-1 rounded-xl p-2.5 text-center"
                      style={{ background: `${color}12` }}
                    >
                      <p className="font-black text-sm" style={{ color }}>{formatDuration(s.elapsedSeconds ?? 0)}</p>
                      <p className="text-[10px] text-white/35">Duración</p>
                    </div>
                    <div
                      className="flex-1 rounded-xl p-2.5 text-center"
                      style={{ background: `${color}12` }}
                    >
                      <p className="font-black text-sm" style={{ color }}>{notes.length}</p>
                      <p className="text-[10px] text-white/35">Notas</p>
                    </div>
                    <div
                      className="flex-1 rounded-xl p-2.5 text-center"
                      style={{ background: `${color}12` }}
                    >
                      <p className="font-black text-sm" style={{ color }}>{checkins.length}</p>
                      <p className="text-[10px] text-white/35">Check-ins</p>
                    </div>
                    {s.overallRating && (
                      <div
                        className="flex-1 rounded-xl p-2.5 text-center"
                        style={{ background: `${color}12` }}
                      >
                        <p className="font-black text-sm flex items-center justify-center gap-1" style={{ color }}>
                          <Star className="w-3 h-3" fill={color} /> {s.overallRating}
                        </p>
                        <p className="text-[10px] text-white/35">Rating</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 px-5 mb-3 shrink-0">
                  {([
                    { id: "notas",   label: `Notas (${notes.length})` },
                    { id: "curva",   label: `Curva (${checkins.length})` },
                    ...(hasRatings ? [{ id: "ratings", label: "Ratings" }] : []),
                  ] as { id: typeof activeTab; label: string }[]).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setActiveTab(t.id)}
                      className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                      style={{
                        background: activeTab === t.id ? `${color}20` : "rgba(255,255,255,0.05)",
                        color: activeTab === t.id ? color : "rgba(255,255,255,0.4)",
                        border: `1px solid ${activeTab === t.id ? color + "50" : "transparent"}`,
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto px-5 pb-8">

                  {/* ── NOTAS TAB ── */}
                  {activeTab === "notas" && (
                    <div className="space-y-4">
                      {notes.length === 0 && (
                        <div className="text-center py-10">
                          <p className="text-3xl mb-2">📭</p>
                          <p className="text-white/40 text-sm">No capturaste notas en esta sesión</p>
                        </div>
                      )}

                      {/* Insights primero */}
                      {insights.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#fbbf24" }}>
                            💡 Insights ({insights.length})
                          </p>
                          <div className="space-y-2">
                            {insights.map((n) => (
                              <NoteCard key={n.id} note={n} color={color} />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tareas */}
                      {taskNotes.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#4ade80" }}>
                            ✅ Tareas ({taskNotes.length})
                          </p>
                          <div className="space-y-2">
                            {taskNotes.map((n) => (
                              <NoteCard key={n.id} note={n} color={color} />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Notas/Voz */}
                      {regularNotes.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>
                            📝 Notas ({regularNotes.length})
                          </p>
                          <div className="space-y-2">
                            {regularNotes.map((n) => (
                              <NoteCard key={n.id} note={n} color={color} />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Reflexión escrita */}
                      {s.summary && (
                        <div
                          className="rounded-2xl p-4"
                          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                        >
                          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>
                            🪞 Reflexión
                          </p>
                          <p className="text-sm text-white/80 leading-relaxed">{s.summary}</p>
                        </div>
                      )}

                      {/* AI Summary */}
                      {s.aiSummary && (
                        <div
                          className="rounded-2xl p-4"
                          style={{ background: `${color}0d`, border: `1px solid ${color}30` }}
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <Sparkles className="w-4 h-4" style={{ color }} />
                            <p className="text-xs font-bold uppercase tracking-widest" style={{ color }}>
                              Análisis AI
                            </p>
                          </div>
                          {s.aiSummary.split("\n").filter(Boolean).map((line, i) => (
                            <p key={i} className="text-sm text-white/75 leading-relaxed mb-1">{line}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── CURVA TAB ── */}
                  {activeTab === "curva" && (
                    <div>
                      {checkins.length === 0 ? (
                        <div className="text-center py-10">
                          <p className="text-3xl mb-2">📈</p>
                          <p className="text-white/40 text-sm">No marcaste momentos en esta sesión</p>
                          <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>
                            En la próxima usa "Marcar momento" para ver la curva de intensidad
                          </p>
                        </div>
                      ) : (
                        <>
                          <div
                            className="rounded-2xl p-4 mb-4"
                            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                          >
                            <SessionCurve checkins={checkins} color={color} height={160} />
                          </div>

                          {/* Checkin list */}
                          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>
                            Momentos marcados
                          </p>
                          <div className="space-y-2">
                            {checkins.map((c) => (
                              <div
                                key={c.id}
                                className="flex items-center gap-3 rounded-xl p-3"
                                style={{ background: "rgba(255,255,255,0.04)" }}
                              >
                                <div
                                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-black text-sm"
                                  style={{ background: `${color}20`, color }}
                                >
                                  {c.intensity}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-white text-sm font-semibold">Min {c.minutesMark}</p>
                                  {(c.tags ?? []).length > 0 && (
                                    <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.4)" }}>
                                      {(c.tags ?? []).join(" · ")}
                                    </p>
                                  )}
                                </div>
                                <p className="text-xs shrink-0" style={{ color: "rgba(255,255,255,0.3)" }}>
                                  {formatTime(c.createdAt)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* ── RATINGS TAB ── */}
                  {activeTab === "ratings" && hasRatings && (
                    <div className="space-y-4">
                      {/* Mood change */}
                      {s.moodBefore && s.moodAfter && (
                        <div
                          className="rounded-2xl p-4 flex items-center gap-4"
                          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                        >
                          <div className="text-center">
                            <p className="text-2xl">😐</p>
                            <p className="text-white font-bold">{s.moodBefore}</p>
                            <p className="text-xs text-white/30">Antes</p>
                          </div>
                          <div className="flex-1 h-px" style={{ background: `${color}40` }} />
                          <div className="text-center">
                            <p className="text-2xl">🤩</p>
                            <p className="text-white font-bold">{s.moodAfter}</p>
                            <p className="text-xs text-white/30">Después</p>
                          </div>
                          <div
                            className="px-2.5 py-1 rounded-full text-xs font-bold"
                            style={{
                              background: s.moodAfter >= s.moodBefore ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)",
                              color: s.moodAfter >= s.moodBefore ? "#4ade80" : "#f87171",
                            }}
                          >
                            {s.moodAfter >= s.moodBefore ? "+" : ""}{s.moodAfter - s.moodBefore}
                          </div>
                        </div>
                      )}

                      {/* Dimension bars */}
                      <div className="space-y-3">
                        {DIMENSIONS.map((dim) => {
                          const val = s[dim.key as keyof Session] as number | null | undefined;
                          if (!val) return null;
                          return (
                            <div key={dim.key}>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-sm text-white font-medium">{dim.emoji} {dim.label}</span>
                                <span className="text-sm font-black" style={{ color }}>{val}<span className="text-white/30">/10</span></span>
                              </div>
                              <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${(val / 10) * 100}%` }}
                                  transition={{ duration: 0.6, ease: "easeOut" }}
                                  className="h-full rounded-full"
                                  style={{ background: color }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Overall */}
                      {s.overallRating && (
                        <div
                          className="rounded-2xl p-4 text-center"
                          style={{ background: `${color}12`, border: `1px solid ${color}30` }}
                        >
                          <div className="flex items-center justify-center gap-1 mb-1">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <Star
                                key={i}
                                className="w-5 h-5"
                                fill={i <= Math.round((s.overallRating ?? 0) / 2) ? color : "transparent"}
                                style={{ color }}
                              />
                            ))}
                          </div>
                          <p className="text-white font-bold text-lg">{s.overallRating}/10</p>
                          <p className="text-xs text-white/35">Rating general</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function NoteCard({ note, color }: { note: Note; color: string }) {
  const config = NOTE_TYPE_CONFIG[note.type] ?? NOTE_TYPE_CONFIG.text;
  const Icon = config.icon;

  return (
    <div
      className="rounded-2xl p-3.5"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: `${config.color}20` }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm leading-relaxed">{note.content}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {note.minutesMark !== null && (
              <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                min {note.minutesMark}
              </span>
            )}
            {note.convertedToTask && (
              <span
                className="text-[11px] px-2 py-0.5 rounded-full"
                style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80" }}
              >
                → creado como tarea
              </span>
            )}
            {(note.tags ?? []).map((tag) => (
              <span
                key={tag}
                className="text-[11px] px-2 py-0.5 rounded-full"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
