"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Zap, FileText, Lightbulb, CheckSquare, Mic, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { SmokeSession } from "@/db/schema";
import { NoteCapture } from "./note-capture";
import { CheckinWidget } from "./checkin-widget";
import { SessionCloseFlow } from "./session-close-flow";

const CHECKIN_MARKS = [5, 15, 30, 60];

const THEMES = { green: "#00c896", violet: "#9945ff" };

function formatTime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

const TYPE_EMOJIS: Record<string, string> = {
  sativa: "🌿", indica: "🌑", hybrid: "⚡", cbd: "🌸", hash: "🪨", concentrate: "💎",
};
const METHOD_LABELS: Record<string, string> = {
  joint: "Joint", pipe: "Pipe", vape: "Vape", edible: "Edible", bong: "Bong", dab: "Dab",
};
const AMOUNT_LABELS: Record<string, string> = {
  micro: "Micro", low: "Poco", medium: "Medio", heavy: "Fuerte", very_heavy: "Máximo",
};

const NOTE_TYPE_ICONS: Record<string, { emoji: string; color: string }> = {
  text:    { emoji: "📝", color: "#60a5fa" },
  insight: { emoji: "💡", color: "#fbbf24" },
  task:    { emoji: "✅", color: "#4ade80" },
  voice:   { emoji: "🎤", color: "#c084fc" },
};

interface LiveNote { id: string; content: string; type: string; minutesMark: number | null; createdAt: string; }
interface LiveCheckin { id: string; intensity: number; minutesMark: number; tags: string[] | null; }

interface Props { session: SmokeSession; }

export function ActiveSessionClient({ session }: Props) {
  const router = useRouter();
  const [color, setColor] = useState(THEMES.green);
  const [elapsed, setElapsed] = useState(0);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDefaultType, setNoteDefaultType] = useState<"text" | "insight" | "task" | "voice">("text");
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkinMinute, setCheckinMinute] = useState(0);
  const [closeOpen, setCloseOpen] = useState(false);
  const [notes, setNotes] = useState<LiveNote[]>([]);
  const [checkins, setCheckins] = useState<LiveCheckin[]>([]);
  const [notesOpen, setNotesOpen] = useState(false);
  const triggeredRef = useRef<Set<number>>(new Set());

  // Load theme from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("verde-420-mode");
    if (stored === "violet") setColor(THEMES.violet);
  }, []);

  // Load already-triggered check-in marks from localStorage to prevent loops on re-mount
  useEffect(() => {
    try {
      const key = `verde-triggered-${session.id}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        const marks: number[] = JSON.parse(stored);
        marks.forEach((m) => triggeredRef.current.add(m));
      }
    } catch {}
  }, [session.id]);

  // Load existing notes & checkins on mount
  useEffect(() => {
    fetch(`/api/420/sessions/${session.id}`)
      .then((r) => r.json())
      .then(({ notes: n, checkins: c }) => {
        setNotes(n ?? []);
        setCheckins(c ?? []);
        // Pre-populate triggered marks from existing DB checkins
        (c ?? []).forEach((ci: LiveCheckin) => {
          const closestMark = CHECKIN_MARKS.find((m) => Math.abs(ci.minutesMark - m) <= 3);
          if (closestMark) {
            triggeredRef.current.add(closestMark);
            try {
              const key = `verde-triggered-${session.id}`;
              const stored = localStorage.getItem(key);
              const marks: number[] = stored ? JSON.parse(stored) : [];
              if (!marks.includes(closestMark)) {
                marks.push(closestMark);
                localStorage.setItem(key, JSON.stringify(marks));
              }
            } catch {}
          }
        });
      })
      .catch(() => {});
  }, [session.id]);

  // Timer — pauses when page is hidden (saves battery)
  useEffect(() => {
    const startMs = new Date(session.startedAt).getTime();
    let intervalId: ReturnType<typeof setInterval>;

    function tick() {
      setElapsed(Math.floor((Date.now() - startMs) / 1000));
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        clearInterval(intervalId);
      } else {
        tick();
        intervalId = setInterval(tick, 1000);
      }
    }

    tick();
    intervalId = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [session.startedAt]);

  // Auto check-in prompts — only trigger once per mark, persisted in localStorage
  useEffect(() => {
    const elapsedMin = Math.floor(elapsed / 60);
    for (const mark of CHECKIN_MARKS) {
      if (elapsedMin >= mark && !triggeredRef.current.has(mark) && !checkinOpen) {
        triggeredRef.current.add(mark);
        // Persist so re-mounts don't re-trigger
        try {
          const key = `verde-triggered-${session.id}`;
          const stored = localStorage.getItem(key);
          const marks: number[] = stored ? JSON.parse(stored) : [];
          if (!marks.includes(mark)) {
            marks.push(mark);
            localStorage.setItem(key, JSON.stringify(marks));
          }
        } catch {}
        setCheckinMinute(mark);
        setCheckinOpen(true);
        break; // only one at a time
      }
    }
  }, [elapsed, checkinOpen, session.id]);

  function openNote(type: "text" | "insight" | "task" | "voice") {
    setNoteDefaultType(type);
    setNoteOpen(true);
  }

  function onNoteSaved() {
    // Refetch notes to show live update
    fetch(`/api/420/sessions/${session.id}/notes`)
      .then((r) => r.json())
      .then((data) => setNotes(Array.isArray(data) ? data : []))
      .catch(() => {});
  }

  function onCheckinSaved() {
    fetch(`/api/420/sessions/${session.id}`)
      .then((r) => r.json())
      .then(({ checkins: c }) => setCheckins(c ?? []))
      .catch(() => {});
  }

  const totalItems = notes.length + checkins.length;
  const lastNote = notes[notes.length - 1];

  // Glow alpha based on elapsed time (0.35 → 0.6)
  const glowAlpha = Math.min(0.6, 0.35 + (elapsed / 7200) * 0.25);
  const glowHex = Math.round(glowAlpha * 255).toString(16).padStart(2, "0");

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex flex-col select-none"
        style={{ background: "#050a07" }}
      >
        {/* ── Top bar ── */}
        <div className="flex items-center justify-between px-5 pt-5 pb-2 shrink-0">
          <button
            onClick={() => router.push("/420")}
            className="flex items-center gap-1.5 text-sm"
            style={{ color: "rgba(255,255,255,0.35)" }}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-xs">Flow</span>
          </button>

          {/* Live elapsed — big */}
          <span
            className="font-mono font-black text-white text-lg"
            style={{ textShadow: `0 0 12px ${color}70`, letterSpacing: "-0.02em" }}
          >
            {formatTime(elapsed)}
          </span>
        </div>

        {/* ── Session label ── */}
        <div className="px-5 pb-1 shrink-0">
          <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.38)" }}>
            {TYPE_EMOJIS[session.type]} {session.type} · {METHOD_LABELS[session.method]} · {AMOUNT_LABELS[session.amount]}
            {session.strain && ` · ${session.strain}`}
          </p>
        </div>

        {/* ── Breathing circle ── */}
        <div className="flex-1 flex items-center justify-center">
          <div className="relative flex items-center justify-center">
            {/* Outer ring — CSS animation */}
            <div
              className="absolute rounded-full"
              style={{
                width: 280, height: 280,
                background: `radial-gradient(circle, ${color}22 0%, transparent 70%)`,
                animation: "pulse-ring-verde 4s ease-in-out infinite",
              }}
            />
            <div
              className="absolute rounded-full"
              style={{
                width: 220, height: 220,
                background: `radial-gradient(circle, ${color}33 0%, transparent 70%)`,
                animation: "pulse-ring-inner-verde 4s ease-in-out infinite",
                animationDelay: "0.4s",
              }}
            />

            {/* Main circle — CSS breathe animation */}
            <div
              style={{
                width: 176, height: 176,
                borderRadius: "50%",
                background: `radial-gradient(circle at 38% 32%, ${color}28 0%, ${color}08 100%)`,
                border: `1.5px solid ${color}55`,
                boxShadow: `0 0 50px ${color}${glowHex}, inset 0 0 35px ${color}12`,
                display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
                animation: "breathe-verde 4s ease-in-out infinite",
              }}
            >
              <span
                className="font-mono font-black leading-none"
                style={{ fontSize: elapsed >= 3600 ? 26 : 32, color: "#fff", textShadow: `0 0 16px ${color}80` }}
              >
                {formatTime(elapsed)}
              </span>
              <span className="text-[11px] mt-1 font-medium" style={{ color: `${color}88` }}>
                en sesión
              </span>
            </div>
          </div>
        </div>

        {/* ── Notes/checkins preview strip ── */}
        <div className="px-5 mb-3 shrink-0">
          <button
            onClick={() => setNotesOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-all active:scale-[0.98]"
            style={{
              background: totalItems > 0 ? `${color}10` : "rgba(255,255,255,0.04)",
              border: `1px solid ${totalItems > 0 ? color + "30" : "rgba(255,255,255,0.07)"}`,
            }}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {totalItems === 0 ? (
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                  Sin notas aún — usa los botones de abajo
                </p>
              ) : (
                <>
                  <span className="text-xs font-bold" style={{ color }}>
                    {notes.length > 0 && `📝 ${notes.length}`}
                    {notes.length > 0 && checkins.length > 0 && "  "}
                    {checkins.length > 0 && `⚡ ${checkins.length}`}
                  </span>
                  {lastNote && (
                    <span className="text-xs truncate flex-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                      · {NOTE_TYPE_ICONS[lastNote.type]?.emoji} {lastNote.content.slice(0, 40)}{lastNote.content.length > 40 ? "…" : ""}
                    </span>
                  )}
                </>
              )}
            </div>
            {totalItems > 0 && (
              <span className="text-xs shrink-0" style={{ color }}>Ver →</span>
            )}
          </button>
        </div>

        {/* ── Action buttons ── */}
        <div className="px-5 pb-4 shrink-0">
          <div className="grid grid-cols-4 gap-2.5 mb-3">
            {[
              { icon: Lightbulb,   label: "Insight", type: "insight" as const },
              { icon: FileText,    label: "Nota",    type: "text" as const },
              { icon: Mic,         label: "Voz",     type: "voice" as const },
              { icon: CheckSquare, label: "Tarea",   type: "task" as const },
            ].map(({ icon: Icon, label, type }) => (
              <button
                key={type}
                onClick={() => openNote(type)}
                className="flex flex-col items-center gap-1.5 py-3.5 rounded-2xl transition-all active:scale-95"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <Icon className="w-5 h-5" style={{ color }} />
                <span className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.45)" }}>
                  {label}
                </span>
              </button>
            ))}
          </div>

          {/* Check-in */}
          <button
            onClick={() => { setCheckinMinute(Math.floor(elapsed / 60)); setCheckinOpen(true); }}
            className="w-full py-3 rounded-xl text-sm font-semibold mb-2.5 flex items-center justify-center gap-2 transition-all active:scale-95"
            style={{ background: `${color}14`, border: `1px solid ${color}38`, color }}
          >
            <Zap className="w-4 h-4" />
            Marcar momento
          </button>

          {/* End session */}
          <button
            onClick={() => setCloseOpen(true)}
            className="w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-95"
            style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.22)", color: "#f87171" }}
          >
            Terminar sesión
          </button>
        </div>
      </div>

      {/* ── Live notes sheet ── */}
      <AnimatePresence>
        {notesOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/50"
              onClick={() => setNotesOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 360 }}
              className="fixed bottom-0 left-0 right-0 z-[61] rounded-t-3xl flex flex-col"
              style={{ background: "#0a1010", maxHeight: "80dvh" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>
              <div className="flex items-center justify-between px-5 py-3 shrink-0">
                <h3 className="font-bold text-white text-base">Esta sesión</h3>
                <button
                  onClick={() => setNotesOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                >
                  <X className="w-4 h-4 text-white/50" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-4">
                {/* Notes */}
                {notes.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>
                      Notas ({notes.length})
                    </p>
                    <div className="space-y-2">
                      {[...notes].reverse().map((n) => {
                        const cfg = NOTE_TYPE_ICONS[n.type] ?? NOTE_TYPE_ICONS.text;
                        return (
                          <div
                            key={n.id}
                            className="rounded-xl px-4 py-3 flex items-start gap-3"
                            style={{ background: "rgba(255,255,255,0.05)" }}
                          >
                            <span className="text-base shrink-0 mt-0.5">{cfg.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm leading-relaxed">{n.content}</p>
                              {n.minutesMark !== null && (
                                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.28)" }}>
                                  min {n.minutesMark}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Checkins */}
                {checkins.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>
                      Check-ins ({checkins.length})
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {checkins.map((c) => (
                        <div
                          key={c.id}
                          className="rounded-xl px-3 py-2 flex items-center gap-2"
                          style={{ background: `${color}12`, border: `1px solid ${color}30` }}
                        >
                          <span className="font-black text-sm" style={{ color }}>{c.intensity}</span>
                          <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>min {c.minutesMark}</span>
                          {(c.tags ?? []).length > 0 && (
                            <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                              · {(c.tags ?? []).join(", ")}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {totalItems === 0 && (
                  <div className="text-center py-10">
                    <p className="text-3xl mb-2">🌱</p>
                    <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
                      Todavía no hay nada — agrega tu primera nota
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Note sheet ── */}
      <NoteCapture
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        sessionId={session.id}
        minutesMark={Math.floor(elapsed / 60)}
        color={color}
        onSaved={onNoteSaved}
      />

      {/* ── Check-in sheet ── */}
      <CheckinWidget
        open={checkinOpen}
        onClose={() => setCheckinOpen(false)}
        sessionId={session.id}
        minutesMark={checkinMinute}
        color={color}
        onSaved={onCheckinSaved}
      />

      {/* ── Close flow ── */}
      <AnimatePresence>
        {closeOpen && (
          <SessionCloseFlow
            session={session}
            elapsedSeconds={elapsed}
            color={color}
            onDone={() => router.push("/420")}
            onCancel={() => setCloseOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
