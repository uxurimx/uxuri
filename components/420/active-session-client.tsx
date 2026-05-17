"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Zap, FileText, Lightbulb, CheckSquare, Mic } from "lucide-react";
import { useRouter } from "next/navigation";
import type { SmokeSession } from "@/db/schema";
import { NoteCapture } from "./note-capture";
import { CheckinWidget } from "./checkin-widget";
import { SessionCloseFlow } from "./session-close-flow";

const CHECKIN_MARKS = [5, 15, 30, 60];

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

const THEMES = {
  green:  "#00c896",
  violet: "#9945ff",
};

interface Props {
  session: SmokeSession;
}

export function ActiveSessionClient({ session }: Props) {
  const router = useRouter();
  const [color, setColor] = useState(THEMES.green);

  useEffect(() => {
    const stored = localStorage.getItem("verde-420-mode");
    if (stored === "violet") setColor(THEMES.violet);
  }, []);
  const [elapsed, setElapsed] = useState(0);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDefaultType, setNoteDefaultType] = useState<"text" | "insight" | "task" | "voice">("text");
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkinMinute, setCheckinMinute] = useState(0);
  const [closeOpen, setCloseOpen] = useState(false);
  const [noteCount, setNoteCount] = useState(0);
  const [checkinCount, setCheckinCount] = useState(0);
  const triggeredRef = useRef<Set<number>>(new Set());
  const [autoPrompt, setAutoPrompt] = useState<number | null>(null);

  // Live timer
  useEffect(() => {
    const startMs = new Date(session.startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - startMs) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session.startedAt]);

  // Auto check-in prompts
  useEffect(() => {
    const elapsedMin = Math.floor(elapsed / 60);
    for (const mark of CHECKIN_MARKS) {
      if (elapsedMin >= mark && !triggeredRef.current.has(mark)) {
        triggeredRef.current.add(mark);
        setAutoPrompt(mark);
      }
    }
  }, [elapsed]);

  useEffect(() => {
    if (autoPrompt !== null && !checkinOpen) {
      setCheckinMinute(autoPrompt);
      setCheckinOpen(true);
      setAutoPrompt(null);
    }
  }, [autoPrompt, checkinOpen]);

  function openNote(type: "text" | "insight" | "task" | "voice") {
    setNoteDefaultType(type);
    setNoteOpen(true);
  }

  function onNoteSaved() { setNoteCount((n) => n + 1); }
  function onCheckinSaved() { setCheckinCount((n) => n + 1); }

  function handleManualCheckin() {
    setCheckinMinute(Math.floor(elapsed / 60));
    setCheckinOpen(true);
  }

  // Intensity-aware glow: more intense = more glow
  const glowIntensity = Math.min(1, 0.4 + (elapsed / 3600) * 0.3);

  return (
    <>
      {/* Full-screen overlay */}
      <div
        className="fixed inset-0 z-50 flex flex-col"
        style={{ background: "#050a07", userSelect: "none", WebkitUserSelect: "none" }}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 pt-safe-top pt-4 pb-3">
          <button
            onClick={() => router.push("/420")}
            className="flex items-center gap-2 text-sm"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-xs">Dashboard</span>
          </button>

          <div className="flex items-center gap-3 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
            {checkinCount > 0 && (
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3" style={{ color }} /> {checkinCount}
              </span>
            )}
            {noteCount > 0 && (
              <span className="flex items-center gap-1">
                <FileText className="w-3 h-3" style={{ color }} /> {noteCount}
              </span>
            )}
          </div>
        </div>

        {/* Session info */}
        <div className="text-center px-5 pb-2">
          <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>
            {TYPE_EMOJIS[session.type]} {session.type} · {METHOD_LABELS[session.method]} · {AMOUNT_LABELS[session.amount]}
            {session.strain && ` · ${session.strain}`}
          </p>
        </div>

        {/* Breathing circle — main focus */}
        <div className="flex-1 flex items-center justify-center">
          <div className="relative flex items-center justify-center">
            {/* Outer glow rings */}
            <motion.div
              animate={{ scale: [0.85, 1.15, 0.85], opacity: [0.08, 0.18, 0.08] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute rounded-full"
              style={{
                width: 280,
                height: 280,
                background: `radial-gradient(circle, ${color}35 0%, transparent 70%)`,
              }}
            />
            <motion.div
              animate={{ scale: [0.92, 1.08, 0.92], opacity: [0.12, 0.25, 0.12] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
              className="absolute rounded-full"
              style={{
                width: 220,
                height: 220,
                background: `radial-gradient(circle, ${color}50 0%, transparent 70%)`,
              }}
            />

            {/* Main breathing circle */}
            <motion.div
              animate={{ scale: [0.93, 1.0, 0.93] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              style={{
                width: 176,
                height: 176,
                borderRadius: "50%",
                background: `radial-gradient(circle at 40% 35%, ${color}30 0%, ${color}08 100%)`,
                border: `2px solid ${color}60`,
                boxShadow: `0 0 60px ${color}${Math.round(glowIntensity * 255).toString(16).padStart(2, "0")}, inset 0 0 40px ${color}15`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column" as const,
              }}
            >
              {/* Timer */}
              <span
                className="font-mono font-black tracking-tight leading-none"
                style={{
                  fontSize: elapsed >= 3600 ? 26 : 32,
                  color: "#ffffff",
                  textShadow: `0 0 20px ${color}80`,
                }}
              >
                {formatTime(elapsed)}
              </span>
              <span className="text-xs mt-1 font-medium" style={{ color: `${color}90` }}>
                en sesión
              </span>
            </motion.div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-5 pb-4">
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { icon: Lightbulb, label: "Insight", type: "insight" as const },
              { icon: FileText, label: "Nota",    type: "text" as const },
              { icon: Mic,       label: "Voz",    type: "voice" as const },
              { icon: CheckSquare,label: "Tarea", type: "task" as const },
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
                <span className="text-[11px] font-semibold text-white/50">{label}</span>
              </button>
            ))}
          </div>

          {/* Check-in manual */}
          <button
            onClick={handleManualCheckin}
            className="w-full py-3 rounded-xl text-sm font-semibold mb-3 flex items-center justify-center gap-2 transition-all active:scale-95"
            style={{
              background: `${color}15`,
              border: `1px solid ${color}40`,
              color,
            }}
          >
            <Zap className="w-4 h-4" />
            Marcar momento
          </button>

          {/* End session */}
          <button
            onClick={() => setCloseOpen(true)}
            className="w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-95"
            style={{
              background: "rgba(248,113,113,0.12)",
              border: "1px solid rgba(248,113,113,0.25)",
              color: "#f87171",
            }}
          >
            Terminar sesión
          </button>
        </div>
      </div>

      {/* Note sheet */}
      <NoteCapture
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        sessionId={session.id}
        minutesMark={Math.floor(elapsed / 60)}
        color={color}
        onSaved={onNoteSaved}
      />

      {/* Check-in sheet */}
      <CheckinWidget
        open={checkinOpen}
        onClose={() => setCheckinOpen(false)}
        sessionId={session.id}
        minutesMark={checkinMinute}
        color={color}
        onSaved={onCheckinSaved}
      />

      {/* Close flow */}
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
