"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Timer, Play, Pause, SkipForward, X, Coffee, Brain, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { startTimer } from "@/components/timer/active-timer";

// ─── Types & Config ───────────────────────────────────────────────────────────

type Phase = "idle" | "focus" | "break" | "longBreak";

const PHASE_CONFIG = {
  idle:      { label: "Listo",           minutes: 25, color: "text-slate-500",   bg: "bg-slate-50",   ring: "ring-slate-200" },
  focus:     { label: "Enfoque",         minutes: 25, color: "text-[#1e3a5f]",   bg: "bg-[#1e3a5f]/5", ring: "ring-[#1e3a5f]/30" },
  break:     { label: "Descanso corto",  minutes: 5,  color: "text-emerald-600", bg: "bg-emerald-50", ring: "ring-emerald-200" },
  longBreak: { label: "Descanso largo",  minutes: 15, color: "text-blue-600",    bg: "bg-blue-50",    ring: "ring-blue-200" },
};

function formatMSS(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function notifyPhase(phase: Phase) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  const msg = phase === "focus"
    ? "¡Hora de enfocarse! 🎯 25 minutos."
    : phase === "longBreak"
    ? "¡Descanso largo! ☕ 15 minutos."
    : "¡Descanso corto! 🌿 5 minutos.";
  if (Notification.permission === "granted") {
    new Notification("Uxuri – Pomodoro", { body: msg, icon: "/icons/icon-192.png" });
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

interface PomodoroWidgetProps {
  className?: string;
}

export function PomodoroWidget({ className }: PomodoroWidgetProps) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [secondsLeft, setSecondsLeft] = useState(PHASE_CONFIG.focus.minutes * 60);
  const [running, setRunning] = useState(false);
  const [pomodoroCount, setPomodoroCount] = useState(0);
  const [taskLabel, setTaskLabel] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [customMinutes, setCustomMinutes] = useState({ focus: 25, shortBreak: 5, longBreak: 15 });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerSessionStarted = useRef(false);

  const totalSeconds = (phase === "idle" ? customMinutes.focus
    : phase === "focus" ? customMinutes.focus
    : phase === "break" ? customMinutes.shortBreak
    : customMinutes.longBreak) * 60;

  const pct = Math.round((1 - secondsLeft / totalSeconds) * 100);

  // ── Tick ──
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            setRunning(false);
            handlePhaseComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  function handlePhaseComplete() {
    if (phase === "focus") {
      const newCount = pomodoroCount + 1;
      setPomodoroCount(newCount);
      const nextPhase = newCount % 4 === 0 ? "longBreak" : "break";
      setPhase(nextPhase);
      setSecondsLeft((nextPhase === "longBreak" ? customMinutes.longBreak : customMinutes.shortBreak) * 60);
      notifyPhase(nextPhase);
      timerSessionStarted.current = false;
    } else {
      setPhase("focus");
      setSecondsLeft(customMinutes.focus * 60);
      notifyPhase("focus");
    }
  }

  function handleStart() {
    if (phase === "idle") setPhase("focus");
    setRunning(true);
    // Start a time session on first focus
    if ((phase === "idle" || phase === "focus") && !timerSessionStarted.current) {
      timerSessionStarted.current = true;
      startTimer({ description: taskLabel || "Sesión Pomodoro" });
    }
  }

  function handlePause() {
    setRunning(false);
  }

  function handleSkip() {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (phase === "focus") {
      const newCount = pomodoroCount + 1;
      setPomodoroCount(newCount);
      const nextPhase = newCount % 4 === 0 ? "longBreak" : "break";
      setPhase(nextPhase);
      setSecondsLeft((nextPhase === "longBreak" ? customMinutes.longBreak : customMinutes.shortBreak) * 60);
      timerSessionStarted.current = false;
    } else {
      setPhase("focus");
      setSecondsLeft(customMinutes.focus * 60);
    }
  }

  function handleReset() {
    setRunning(false);
    setPhase("idle");
    setSecondsLeft(customMinutes.focus * 60);
    setPomodoroCount(0);
    timerSessionStarted.current = false;
  }

  const cfg = PHASE_CONFIG[phase];

  // ── Topbar pill ──
  const isActive = phase !== "idle" || running;

  return (
    <>
      {/* Topbar trigger */}
      <button
        onClick={() => setOpen(true)}
        title="Pomodoro"
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all",
          running
            ? "bg-[#1e3a5f]/10 border-[#1e3a5f]/30 text-[#1e3a5f]"
            : "border-slate-200 text-slate-500 hover:bg-slate-50",
          className
        )}
      >
        <Timer className="w-3.5 h-3.5" />
        {running ? (
          <span className="tabular-nums font-mono">{formatMSS(secondsLeft)}</span>
        ) : (
          <span>Foco</span>
        )}
        {pomodoroCount > 0 && (
          <span className="flex gap-0.5 ml-0.5">
            {Array.from({ length: Math.min(pomodoroCount, 4) }).map((_, i) => (
              <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#1e3a5f]/60" />
            ))}
          </span>
        )}
      </button>

      {/* Floating panel */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-end pt-16 pr-4 pointer-events-none">
          <div className={cn(
            "pointer-events-auto w-80 rounded-2xl shadow-2xl border-2 p-5 space-y-4 transition-all",
            cfg.bg, cfg.ring, "ring-2"
          )}>
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {phase === "focus" ? <Brain className="w-4 h-4 text-[#1e3a5f]" /> : <Coffee className="w-4 h-4 text-emerald-600" />}
                <span className={cn("text-sm font-semibold", cfg.color)}>{cfg.label}</span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setShowSettings(!showSettings)} className="p-1 text-slate-400 hover:text-slate-600">
                  <Settings className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Settings panel */}
            {showSettings && (
              <div className="bg-white/70 rounded-xl p-3 space-y-2 text-xs">
                {([["focus", "Enfoque (min)"], ["shortBreak", "Descanso corto"], ["longBreak", "Descanso largo"]] as const).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-slate-600">{label}</span>
                    <input
                      type="number"
                      min={1} max={60}
                      value={customMinutes[key]}
                      onChange={(e) => {
                        const v = parseInt(e.target.value) || 25;
                        setCustomMinutes((prev) => ({ ...prev, [key]: v }));
                        if (!running && phase !== "break" && phase !== "longBreak") setSecondsLeft(v * 60);
                      }}
                      className="w-14 text-center border border-slate-200 rounded-lg px-2 py-1"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Task label */}
            <input
              value={taskLabel}
              onChange={(e) => setTaskLabel(e.target.value)}
              placeholder="¿En qué te vas a enfocar?"
              className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200/60 bg-white/50 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 placeholder-slate-300"
            />

            {/* Circular progress + timer */}
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="relative w-36 h-36">
                <svg className="w-36 h-36 -rotate-90" viewBox="0 0 144 144">
                  <circle cx="72" cy="72" r="60" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-200" />
                  <circle
                    cx="72" cy="72" r="60" fill="none" strokeWidth="8"
                    stroke={phase === "focus" ? "#1e3a5f" : phase === "break" ? "#059669" : "#2563eb"}
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 60}`}
                    strokeDashoffset={`${2 * Math.PI * 60 * (1 - pct / 100)}`}
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={cn("text-3xl font-bold font-mono tabular-nums", cfg.color)}>
                    {formatMSS(secondsLeft)}
                  </span>
                  <span className="text-xs text-slate-400 mt-0.5">
                    {phase === "focus" ? "enfoque" : phase === "idle" ? "listo" : "descanso"}
                  </span>
                </div>
              </div>

              {/* Pomodoro dots */}
              <div className="flex gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className={cn(
                    "w-3 h-3 rounded-full border-2 transition-all",
                    i < (pomodoroCount % 4)
                      ? "bg-[#1e3a5f] border-[#1e3a5f]"
                      : "bg-transparent border-slate-300"
                  )} />
                ))}
              </div>
            </div>

            {/* Controls */}
            <div className="flex gap-2">
              {running ? (
                <button onClick={handlePause} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                  <Pause className="w-4 h-4" /> Pausar
                </button>
              ) : (
                <button onClick={handleStart} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#1e3a5f] text-white rounded-xl text-sm font-medium hover:bg-[#162d4a] transition-colors">
                  <Play className="w-4 h-4" /> {phase === "idle" ? "Empezar" : "Continuar"}
                </button>
              )}
              <button onClick={handleSkip} title="Saltar fase" className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors">
                <SkipForward className="w-4 h-4" />
              </button>
              <button onClick={handleReset} title="Reiniciar" className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors text-xs">
                ✕
              </button>
            </div>

            {pomodoroCount > 0 && (
              <p className="text-center text-xs text-slate-400">
                {pomodoroCount} {pomodoroCount === 1 ? "pomodoro completado" : "pomodoros completados"} hoy
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
