"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Zap, FileText, Lightbulb, CheckSquare, Mic, X, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import type { SmokeSession } from "@/db/schema";
import { NoteCapture } from "./note-capture";
import { CheckinWidget } from "./checkin-widget";
import { SessionCloseFlow } from "./session-close-flow";

const CHECKIN_MARKS = [5, 15, 30, 60];
const THEMES = { green: "#00c896", violet: "#9945ff" };

const PHRASES = [
  "Respira. Estás exactamente donde debes estar.",
  "La creatividad fluye cuando la mente descansa.",
  "Cada momento es una oportunidad de ver diferente.",
  "Escúchate. Tu intuición sabe el camino.",
  "La profundidad no se busca, se permite.",
  "Estás conectado con algo más grande.",
  "Siente el presente sin juzgarlo.",
  "Las mejores ideas llegan cuando el control se suelta.",
  "Eres el observador y la experiencia al mismo tiempo.",
  "La expansión no asusta, fascina.",
  "Cada respiración es un ancla al ahora.",
  "Tu mente es un universo que apenas exploras.",
  "Lo ordinario se vuelve extraordinario con presencia.",
  "El silencio interior tiene mucho que decir.",
  "Confía en el proceso, incluso sin entenderlo.",
  "La conciencia expandida revela lo que siempre estuvo ahí.",
  "Fluye con lo que es, no con lo que debería ser.",
  "Tu curiosidad es tu brújula más confiable.",
  "La percepción cambia; la esencia permanece.",
  "Este momento no volverá. Siéntelo completo.",
  "Observa sin aferrarte. Fluye sin resistencia.",
  "El presente es el único lugar donde todo sucede.",
  "Lo que buscas afuera ya vive dentro de ti.",
  "La quietud no es ausencia; es la base de todo.",
];

const PSYCHEDELIC_COLORS = [
  "#00c896", "#9945ff", "#00d4ff", "#ff6b35", "#ff3e9d", "#c8ff00", "#ff9500",
];

type ColorMode = "default" | "flow" | "psychedelic";

const MODE_ICONS: Record<ColorMode, string> = { default: "●", flow: "◐", psychedelic: "✦" };
const MODE_NEXT_LABEL: Record<ColorMode, string> = {
  default: "flow", flow: "psicodélico", psychedelic: "estático",
};

function formatTime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function isTimerPattern(s: number): boolean {
  if (s <= 4) return false;
  const display = formatTime(s);
  const special = ["11:11", "22:22", "33:33", "44:44", "55:55", "12:34", "23:45", "1:11:11", "1:23:45", "2:22:22"];
  if (special.includes(display)) return true;
  if (s > 0 && s % 600 === 0) return true;
  if (s > 0 && s % 3600 === 0) return true;
  return false;
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

  // ── Color system ──────────────────────────────────────────────
  const [baseColor, setBaseColor] = useState(THEMES.green);
  const [displayColor, setDisplayColor] = useState(THEMES.green);
  const [colorMode, setColorMode] = useState<ColorMode>("default");
  const hueRef = useRef(120);
  const psychIndexRef = useRef(0);

  // ── Timer & patterns ──────────────────────────────────────────
  const [elapsed, setElapsed] = useState(0);
  const [patternGlow, setPatternGlow] = useState(false);
  const [showAnchor, setShowAnchor] = useState(false);
  const [anchorKey, setAnchorKey] = useState(0);
  const [anchorWord, setAnchorWord] = useState("presente");
  const lastPatternSecRef = useRef(-1);

  // ── Phrase rotation ───────────────────────────────────────────
  const [phraseIndex, setPhraseIndex] = useState(() => Math.floor(Math.random() * PHRASES.length));
  const [phraseVisible, setPhraseVisible] = useState(true);

  // ── Objective ─────────────────────────────────────────────────
  const [objective, setObjective] = useState<string | null>(null);

  // ── Breathing rate (Sprint 2) ─────────────────────────────────
  const [breatheDuration, setBreatheDuration] = useState(4);
  const [showBreathControls, setShowBreathControls] = useState(false);

  // ── Timer display mode ────────────────────────────────────────
  type TimerMode = "elapsed" | "clock" | "minutes";
  const [timerMode, setTimerMode] = useState<TimerMode>("elapsed");

  // ── Sound / metrónomo (Sprint 2) ──────────────────────────────
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const soundIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Music widget (Sprint 2) ───────────────────────────────────
  const [musicOpen, setMusicOpen] = useState(false);
  const [trackName, setTrackName] = useState("");
  const [trackInput, setTrackInput] = useState("");
  const [openfyStatus, setOpenfyStatus] = useState<"idle" | "syncing" | "found" | "offline">("idle");

  // ── Notes / checkins / UI ─────────────────────────────────────
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDefaultType, setNoteDefaultType] = useState<"text" | "insight" | "task" | "voice">("text");
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkinMinute, setCheckinMinute] = useState(0);
  const [closeOpen, setCloseOpen] = useState(false);
  const [notes, setNotes] = useState<LiveNote[]>([]);
  const [checkins, setCheckins] = useState<LiveCheckin[]>([]);
  const [notesOpen, setNotesOpen] = useState(false);
  const triggeredRef = useRef<Set<number>>(new Set());

  // ── Load persisted prefs ──────────────────────────────────────
  useEffect(() => {
    const skin = localStorage.getItem("verde-420-mode");
    const base = skin === "violet" ? THEMES.violet : THEMES.green;
    hueRef.current = skin === "violet" ? 270 : 120;
    setBaseColor(base);
    setDisplayColor(base);

    const mode = (localStorage.getItem("verde-color-mode") ?? "default") as ColorMode;
    setColorMode(mode);

    const anchor = localStorage.getItem("verde-anchor-word");
    if (anchor) setAnchorWord(anchor);

    const obj = localStorage.getItem(`verde-objective-${session.id}`);
    if (obj) setObjective(obj);

    const rate = parseFloat(localStorage.getItem("verde-breathe-rate") ?? "4");
    setBreatheDuration(Math.min(8, Math.max(2, isNaN(rate) ? 4 : rate)));

    const track = localStorage.getItem("verde-music-track");
    if (track) { setTrackName(track); setTrackInput(track); }
  }, [session.id]);

  // ── Load triggered check-in marks ────────────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`verde-triggered-${session.id}`);
      if (stored) {
        const marks: number[] = JSON.parse(stored);
        marks.forEach((m) => triggeredRef.current.add(m));
      }
    } catch {}
  }, [session.id]);

  // ── Load existing notes & checkins ───────────────────────────
  useEffect(() => {
    fetch(`/api/420/sessions/${session.id}`)
      .then((r) => r.json())
      .then(({ notes: n, checkins: c }) => {
        setNotes(n ?? []);
        setCheckins(c ?? []);
        (c ?? []).forEach((ci: LiveCheckin) => {
          const closestMark = CHECKIN_MARKS.find((m) => Math.abs(ci.minutesMark - m) <= 3);
          if (closestMark) {
            triggeredRef.current.add(closestMark);
            try {
              const key = `verde-triggered-${session.id}`;
              const stored = localStorage.getItem(key);
              const marks: number[] = stored ? JSON.parse(stored) : [];
              if (!marks.includes(closestMark)) { marks.push(closestMark); localStorage.setItem(key, JSON.stringify(marks)); }
            } catch {}
          }
        });
      })
      .catch(() => {});
  }, [session.id]);

  // ── Timer (pauses when page hidden) ──────────────────────────
  useEffect(() => {
    const startMs = new Date(session.startedAt).getTime();
    let intervalId: ReturnType<typeof setInterval>;
    function tick() { setElapsed(Math.floor((Date.now() - startMs) / 1000)); }
    function onVisibility() {
      if (document.visibilityState === "hidden") clearInterval(intervalId);
      else { tick(); intervalId = setInterval(tick, 1000); }
    }
    tick();
    intervalId = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", onVisibility);
    return () => { clearInterval(intervalId); document.removeEventListener("visibilitychange", onVisibility); };
  }, [session.startedAt]);

  // ── Auto check-in prompts ─────────────────────────────────────
  useEffect(() => {
    const elapsedMin = Math.floor(elapsed / 60);
    for (const mark of CHECKIN_MARKS) {
      if (elapsedMin >= mark && !triggeredRef.current.has(mark) && !checkinOpen) {
        triggeredRef.current.add(mark);
        try {
          const key = `verde-triggered-${session.id}`;
          const stored = localStorage.getItem(key);
          const marks: number[] = stored ? JSON.parse(stored) : [];
          if (!marks.includes(mark)) { marks.push(mark); localStorage.setItem(key, JSON.stringify(marks)); }
        } catch {}
        setCheckinMinute(mark);
        setCheckinOpen(true);
        break;
      }
    }
  }, [elapsed, checkinOpen, session.id]);

  // ── Pattern glow detection ────────────────────────────────────
  useEffect(() => {
    if (isTimerPattern(elapsed) && elapsed !== lastPatternSecRef.current) {
      lastPatternSecRef.current = elapsed;
      try { if ("vibrate" in navigator) navigator.vibrate([20, 80, 20, 80, 20]); } catch {}
      setPatternGlow(true);
      setShowAnchor(true);
      setAnchorKey((k) => k + 1);
      setTimeout(() => setPatternGlow(false), 3800);
      setTimeout(() => setShowAnchor(false), 4200);
    }
  }, [elapsed]);

  // ── Color mode cycling ────────────────────────────────────────
  useEffect(() => {
    if (colorMode === "default") { setDisplayColor(baseColor); return; }
    const interval = colorMode === "flow" ? 8000 : 1100;
    const id = setInterval(() => {
      if (colorMode === "flow") {
        hueRef.current = (hueRef.current + 12) % 360;
        setDisplayColor(`hsl(${hueRef.current}, 72%, 52%)`);
      } else {
        psychIndexRef.current = (psychIndexRef.current + 1) % PSYCHEDELIC_COLORS.length;
        setDisplayColor(PSYCHEDELIC_COLORS[psychIndexRef.current]);
      }
    }, interval);
    return () => clearInterval(id);
  }, [colorMode, baseColor]);

  // ── Phrase rotation ───────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      setPhraseVisible(false);
      setTimeout(() => { setPhraseIndex((i) => (i + 1) % PHRASES.length); setPhraseVisible(true); }, 700);
    }, 45000);
    return () => clearInterval(id);
  }, []);

  // ── Sound metrónomo ───────────────────────────────────────────
  useEffect(() => {
    if (soundIntervalRef.current) { clearInterval(soundIntervalRef.current); soundIntervalRef.current = null; }
    if (!soundEnabled) return;

    function beat() {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume();
      function bump(freq: number, delay: number, dur: number, gain: number) {
        const osc = ctx!.createOscillator();
        const g = ctx!.createGain();
        osc.connect(g); g.connect(ctx!.destination);
        osc.type = "sine";
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0, ctx!.currentTime + delay);
        g.gain.linearRampToValueAtTime(gain, ctx!.currentTime + delay + 0.025);
        g.gain.exponentialRampToValueAtTime(0.001, ctx!.currentTime + delay + dur);
        osc.start(ctx!.currentTime + delay);
        osc.stop(ctx!.currentTime + delay + dur + 0.05);
      }
      // lub-dub heartbeat
      bump(65, 0,    0.13, 0.22);
      bump(55, 0,    0.15, 0.16);
      bump(72, 0.22, 0.11, 0.18);
      bump(62, 0.22, 0.13, 0.12);
    }

    beat();
    soundIntervalRef.current = setInterval(beat, breatheDuration * 1000);
    return () => { if (soundIntervalRef.current) clearInterval(soundIntervalRef.current); };
  }, [soundEnabled, breatheDuration]);

  // ── Helpers ───────────────────────────────────────────────────
  function haptic(pattern: number | number[] = 10) {
    try { if ("vibrate" in navigator) navigator.vibrate(pattern); } catch {}
  }

  function cycleColorMode() {
    haptic(8);
    const modes: ColorMode[] = ["default", "flow", "psychedelic"];
    const next = modes[(modes.indexOf(colorMode) + 1) % 3];
    setColorMode(next);
    localStorage.setItem("verde-color-mode", next);
  }

  function toggleSound() {
    if (!soundEnabled && !audioCtxRef.current) {
      type AC = typeof window.AudioContext;
      const ACtx = (window.AudioContext ?? (window as unknown as Record<string, unknown>).webkitAudioContext) as AC;
      audioCtxRef.current = new ACtx();
    }
    haptic(12);
    const next = !soundEnabled;
    setSoundEnabled(next);
  }

  function updateBreatheRate(v: number) {
    setBreatheDuration(v);
    localStorage.setItem("verde-breathe-rate", String(v));
  }

  function cycleTimerMode() {
    haptic(8);
    setTimerMode((m) => m === "elapsed" ? "clock" : m === "clock" ? "minutes" : "elapsed");
  }

  function getTimerDisplay() {
    if (timerMode === "clock") {
      const now = new Date();
      return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    }
    if (timerMode === "minutes") return `${Math.floor(elapsed / 60)}min`;
    return formatTime(elapsed);
  }

  function getTimerLabel() {
    if (timerMode === "clock") return "hora actual";
    if (timerMode === "minutes") return "transcurridos";
    return "en sesión";
  }

  async function syncOpenfy() {
    setOpenfyStatus("syncing");
    try {
      // Openfy has no "current" endpoint — pull last played from history (userId=1)
      const res = await fetch("http://localhost:3001/api/history?userId=1&limit=1", {
        signal: AbortSignal.timeout(2500),
      });
      if (res.ok) {
        const data = await res.json();
        const title: string | undefined =
          Array.isArray(data) && data.length > 0 ? data[0].title : undefined;
        if (title) {
          setTrackInput(title);
          setOpenfyStatus("found");
        } else {
          setOpenfyStatus("offline");
        }
      } else {
        setOpenfyStatus("offline");
      }
    } catch {
      setOpenfyStatus("offline");
    }
  }

  function saveMusic() {
    const val = trackInput.trim();
    setTrackName(val);
    localStorage.setItem("verde-music-track", val);
    setMusicOpen(false);
  }

  function openNote(type: "text" | "insight" | "task" | "voice") {
    haptic(10);
    setNoteDefaultType(type);
    setNoteOpen(true);
  }

  function onNoteSaved() {
    haptic([12, 50, 12]);
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

          {/* Color mode toggle */}
          <button
            onClick={cycleColorMode}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all active:scale-90"
            style={{
              background: `${displayColor}12`,
              border: `1px solid ${displayColor}28`,
              color: displayColor,
            }}
          >
            <span className="text-[13px]">{MODE_ICONS[colorMode]}</span>
            <span className="text-[10px] font-semibold uppercase tracking-widest opacity-70">
              {colorMode === "default" ? "fijo" : colorMode === "flow" ? "flow" : "psico"}
            </span>
          </button>

          {/* Timer — tappable to cycle mode */}
          <button
            onClick={cycleTimerMode}
            className="font-mono font-black text-white text-lg transition-all active:scale-90"
            style={{
              letterSpacing: "-0.02em",
              textShadow: `0 0 12px ${displayColor}70`,
              animation: patternGlow ? "timer-flash-verde 3.8s ease-out" : "none",
              background: "none", border: "none",
            }}
          >
            {getTimerDisplay()}
          </button>
        </div>

        {/* ── Session label + objective ── */}
        <div className="px-5 pb-1 shrink-0">
          <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.38)" }}>
            {TYPE_EMOJIS[session.type]} {session.type} · {METHOD_LABELS[session.method]} · {AMOUNT_LABELS[session.amount]}
            {session.strain && ` · ${session.strain}`}
          </p>
          {objective && (
            <p className="text-xs text-center mt-1 font-medium" style={{ color: `${displayColor}90` }}>
              ✦ {objective}
            </p>
          )}
        </div>

        {/* ── Breathing circle + controls + phrase ── */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4">

          {/* Circle */}
          <div className="relative flex items-center justify-center">
            <div
              className="absolute rounded-full"
              style={{
                width: 280, height: 280,
                background: `radial-gradient(circle, ${displayColor}22 0%, transparent 70%)`,
                animation: `pulse-ring-verde ${breatheDuration}s ease-in-out infinite`,
              }}
            />
            <div
              className="absolute rounded-full"
              style={{
                width: 220, height: 220,
                background: `radial-gradient(circle, ${displayColor}33 0%, transparent 70%)`,
                animation: `pulse-ring-inner-verde ${breatheDuration}s ease-in-out infinite`,
                animationDelay: `${breatheDuration * 0.1}s`,
              }}
            />
            <button
              onClick={cycleTimerMode}
              style={{
                width: 176, height: 176,
                borderRadius: "50%",
                background: `radial-gradient(circle at 38% 32%, ${displayColor}28 0%, ${displayColor}08 100%)`,
                border: `1.5px solid ${displayColor}55`,
                boxShadow: `0 0 50px ${displayColor}${glowHex}, inset 0 0 35px ${displayColor}12`,
                display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
                animation: `breathe-verde ${breatheDuration}s ease-in-out infinite`,
                transition: "border-color 0.8s ease, box-shadow 0.8s ease",
                cursor: "pointer",
              }}
            >
              <span
                className="font-mono font-black leading-none"
                style={{
                  fontSize: timerMode === "minutes" ? 28 : elapsed >= 3600 ? 26 : 32,
                  color: "#fff",
                  textShadow: patternGlow
                    ? `0 0 30px ${displayColor}, 0 0 60px #fff`
                    : `0 0 16px ${displayColor}80`,
                  animation: patternGlow ? "timer-flash-verde 3.8s ease-out" : "none",
                }}
              >
                {getTimerDisplay()}
              </span>
              <span className="text-[11px] mt-1 font-medium" style={{ color: `${displayColor}88` }}>
                {getTimerLabel()}
              </span>
            </button>

            {/* Anchor word */}
            {showAnchor && (
              <span
                key={anchorKey}
                className="absolute left-1/2 font-mono font-bold text-xs tracking-[0.25em] uppercase"
                style={{
                  bottom: "-28px",
                  color: displayColor,
                  animation: "anchor-rise 4.2s ease-in-out forwards",
                  pointerEvents: "none",
                  textShadow: `0 0 12px ${displayColor}`,
                }}
              >
                {anchorWord}
              </span>
            )}
          </div>

          {/* ── Breath toggle pill ── */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => { haptic(8); setShowBreathControls((v) => !v); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all active:scale-90"
              style={{
                background: showBreathControls ? `${displayColor}18` : "rgba(255,255,255,0.05)",
                border: `1px solid ${showBreathControls ? displayColor + "45" : "rgba(255,255,255,0.09)"}`,
                color: showBreathControls ? displayColor : "rgba(255,255,255,0.3)",
              }}
            >
              <span className="text-sm leading-none">🫧</span>
              <span className="text-[10px] font-mono">{breatheDuration}s</span>
            </button>

            <button
              onClick={toggleSound}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all active:scale-90"
              style={{
                background: soundEnabled ? `${displayColor}18` : "rgba(255,255,255,0.05)",
                border: `1px solid ${soundEnabled ? displayColor + "45" : "rgba(255,255,255,0.09)"}`,
                color: soundEnabled ? displayColor : "rgba(255,255,255,0.28)",
              }}
            >
              <span className="text-sm leading-none">{soundEnabled ? "♫" : "♪"}</span>
              <span className="text-[10px] font-semibold">
                {soundEnabled ? "latido" : "silencio"}
              </span>
            </button>
          </div>

          {/* Slider — visible solo cuando showBreathControls */}
          <AnimatePresence>
            {showBreathControls && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: "easeInOut" }}
                className="overflow-hidden flex items-center gap-3 px-5"
              >
                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>2s</span>
                <input
                  type="range"
                  min={2} max={8} step={0.5}
                  value={breatheDuration}
                  onChange={(e) => { updateBreatheRate(Number(e.target.value)); haptic(6); }}
                  className="flex-1 h-1"
                  style={{ accentColor: displayColor }}
                />
                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>8s</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Rotating phrase */}
          <div className="h-9 flex items-center justify-center px-8">
            <p
              className="text-center text-[11px] leading-relaxed"
              style={{
                color: "rgba(255,255,255,0.26)",
                opacity: phraseVisible ? 1 : 0,
                transform: phraseVisible ? "translateY(0)" : "translateY(5px)",
                transition: "opacity 0.7s ease, transform 0.7s ease",
                maxWidth: 260,
              }}
            >
              {PHRASES[phraseIndex]}
            </p>
          </div>
        </div>

        {/* ── Notes/checkins strip ── */}
        <div className="px-5 mb-2 shrink-0">
          <button
            onClick={() => setNotesOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-all active:scale-[0.98]"
            style={{
              background: totalItems > 0 ? `${displayColor}10` : "rgba(255,255,255,0.04)",
              border: `1px solid ${totalItems > 0 ? displayColor + "30" : "rgba(255,255,255,0.07)"}`,
            }}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {totalItems === 0 ? (
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                  Sin notas aún — usa los botones de abajo
                </p>
              ) : (
                <>
                  <span className="text-xs font-bold" style={{ color: displayColor }}>
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
            {totalItems > 0 && <span className="text-xs shrink-0" style={{ color: displayColor }}>Ver →</span>}
          </button>
        </div>

        {/* ── Music strip ── */}
        <div className="px-5 mb-2.5 shrink-0">
          <button
            onClick={() => { setTrackInput(trackName); setOpenfyStatus("idle"); setMusicOpen(true); }}
            className="w-full flex items-center gap-2.5 px-4 py-2 rounded-xl transition-all active:scale-[0.98]"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <span className="text-sm leading-none" style={{ color: trackName ? displayColor : "rgba(255,255,255,0.18)" }}>
              ♫
            </span>
            <span
              className="text-xs flex-1 text-left truncate"
              style={{ color: trackName ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.2)" }}
            >
              {trackName || "¿Qué estás escuchando?"}
            </span>
            <span className="text-[10px] shrink-0" style={{ color: "rgba(255,255,255,0.18)" }}>
              editar
            </span>
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
                <Icon className="w-5 h-5" style={{ color: displayColor }} />
                <span className="text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.45)" }}>
                  {label}
                </span>
              </button>
            ))}
          </div>

          <button
            onClick={() => { haptic(15); setCheckinMinute(Math.floor(elapsed / 60)); setCheckinOpen(true); }}
            className="w-full py-3 rounded-xl text-sm font-semibold mb-2.5 flex items-center justify-center gap-2 transition-all active:scale-95"
            style={{ background: `${displayColor}14`, border: `1px solid ${displayColor}38`, color: displayColor }}
          >
            <Zap className="w-4 h-4" />
            Marcar momento
          </button>

          <button
            onClick={() => { haptic([25, 50, 25]); setCloseOpen(true); }}
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
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/50"
              onClick={() => setNotesOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
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
                {notes.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>
                      Notas ({notes.length})
                    </p>
                    <div className="space-y-2">
                      {[...notes].reverse().map((n) => {
                        const cfg = NOTE_TYPE_ICONS[n.type] ?? NOTE_TYPE_ICONS.text;
                        return (
                          <div key={n.id} className="rounded-xl px-4 py-3 flex items-start gap-3" style={{ background: "rgba(255,255,255,0.05)" }}>
                            <span className="text-base shrink-0 mt-0.5">{cfg.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm leading-relaxed">{n.content}</p>
                              {n.minutesMark !== null && (
                                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.28)" }}>min {n.minutesMark}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {checkins.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>
                      Check-ins ({checkins.length})
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {checkins.map((c) => (
                        <div key={c.id} className="rounded-xl px-3 py-2 flex items-center gap-2" style={{ background: `${displayColor}12`, border: `1px solid ${displayColor}30` }}>
                          <span className="font-black text-sm" style={{ color: displayColor }}>{c.intensity}</span>
                          <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>min {c.minutesMark}</span>
                          {(c.tags ?? []).length > 0 && (
                            <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>· {(c.tags ?? []).join(", ")}</span>
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

      {/* ── Music sheet ── */}
      <AnimatePresence>
        {musicOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/60"
              onClick={() => setMusicOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 360 }}
              className="fixed bottom-0 left-0 right-0 z-[61] rounded-t-3xl"
              style={{ background: "#080e0a" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>
              <div className="px-5 pb-10 pt-3">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-bold text-white text-base">¿Qué estás escuchando?</h3>
                  <button
                    onClick={() => setMusicOpen(false)}
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(255,255,255,0.08)" }}
                  >
                    <X className="w-4 h-4 text-white/50" />
                  </button>
                </div>

                <input
                  type="text"
                  value={trackInput}
                  onChange={(e) => setTrackInput(e.target.value)}
                  placeholder="Canción, artista o playlist..."
                  autoFocus
                  className="w-full py-3 px-4 rounded-xl text-white placeholder-white/25 outline-none mb-3 text-sm"
                  style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${displayColor}30` }}
                />

                {/* Openfy sync */}
                <button
                  onClick={syncOpenfy}
                  disabled={openfyStatus === "syncing"}
                  className="w-full py-2.5 rounded-xl text-sm font-medium mb-4 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: openfyStatus === "found" ? displayColor : openfyStatus === "offline" ? "#f87171" : "rgba(255,255,255,0.5)",
                  }}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${openfyStatus === "syncing" ? "animate-spin" : ""}`} />
                  {openfyStatus === "idle"    && "↺ Última reproducida en Openfy"}
                  {openfyStatus === "syncing" && "Buscando..."}
                  {openfyStatus === "found"   && "✓ Encontrada — revisa el campo"}
                  {openfyStatus === "offline" && "Openfy no disponible o sin historial"}
                </button>

                <button
                  onClick={saveMusic}
                  className="w-full py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-95"
                  style={{ background: displayColor, color: "#020a06" }}
                >
                  Guardar
                </button>

                {trackName && (
                  <button
                    onClick={() => { setTrackName(""); setTrackInput(""); localStorage.removeItem("verde-music-track"); setMusicOpen(false); }}
                    className="w-full py-2 mt-2 text-xs text-center"
                    style={{ color: "rgba(255,255,255,0.25)" }}
                  >
                    Borrar
                  </button>
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
        color={displayColor}
        onSaved={onNoteSaved}
      />

      {/* ── Check-in sheet ── */}
      <CheckinWidget
        open={checkinOpen}
        onClose={() => setCheckinOpen(false)}
        sessionId={session.id}
        minutesMark={checkinMinute}
        color={displayColor}
        onSaved={onCheckinSaved}
      />

      {/* ── Close flow ── */}
      <AnimatePresence>
        {closeOpen && (
          <SessionCloseFlow
            session={session}
            elapsedSeconds={elapsed}
            color={displayColor}
            onDone={() => router.push("/420")}
            onCancel={() => setCloseOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
