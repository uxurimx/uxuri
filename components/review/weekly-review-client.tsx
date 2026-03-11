"use client";

import { useState, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, CheckCircle2, Star, Zap, Trophy, AlertCircle, ArrowRight, BarChart2, Clock, Repeat2, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ReviewStats = {
  tasksDone: number;
  doneTasks: { id: string; title: string }[];
  weekSeconds: number;
  habitCompletions: number;
  activeObjectives: number;
};

export type ReviewData = {
  workedWell?: string | null;
  didntWork?: string | null;
  biggestWin?: string | null;
  mainLesson?: string | null;
  nextWeekTop3?: string | null;
  energyLevel?: string | null;
  overallRating?: string | null;
};

// ─── Config ──────────────────────────────────────────────────────────────────

const STEPS = [
  { id: "stats",    label: "Resumen",         icon: BarChart2 },
  { id: "energy",   label: "Energía",         icon: Zap },
  { id: "wins",     label: "Victorias",       icon: Trophy },
  { id: "reflect",  label: "Reflexión",       icon: AlertCircle },
  { id: "next",     label: "Próxima semana",  icon: ArrowRight },
];

const ENERGY_OPTIONS = [
  { value: "low",    label: "Baja",    emoji: "😴", color: "border-slate-200 bg-slate-50 text-slate-600" },
  { value: "medium", label: "Normal",  emoji: "😐", color: "border-amber-200 bg-amber-50 text-amber-700" },
  { value: "high",   label: "Alta",    emoji: "⚡", color: "border-emerald-200 bg-emerald-50 text-emerald-700" },
];

function formatSeconds(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function getWeekLabel(weekStart: string) {
  const start = new Date(weekStart + "T12:00:00");
  const end = new Date(weekStart + "T12:00:00");
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(d);
  return `${fmt(start)} – ${fmt(end)}`;
}

function getPrevWeek(weekStart: string) {
  const d = new Date(weekStart + "T12:00:00");
  d.setDate(d.getDate() - 7);
  return d.toISOString().split("T")[0];
}
function getNextWeek(weekStart: string) {
  const d = new Date(weekStart + "T12:00:00");
  d.setDate(d.getDate() + 7);
  return d.toISOString().split("T")[0];
}
function getCurrentWeekStart() {
  const d = new Date();
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return d.toISOString().split("T")[0];
}

// ─── Component ───────────────────────────────────────────────────────────────

interface WeeklyReviewClientProps {
  weekStart: string;
  stats: ReviewStats;
  initialReview: ReviewData | null;
}

export function WeeklyReviewClient({ weekStart, stats, initialReview }: WeeklyReviewClientProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [review, setReview] = useState<ReviewData>(initialReview ?? {});
  const [saved, setSaved] = useState(false);
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);

  const currentWeek = getCurrentWeekStart();
  const isCurrentWeek = weekStart === currentWeek;

  const autoSave = useCallback(async (data: ReviewData) => {
    await fetch(`/api/weekly-review/${weekStart}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [weekStart]);

  function update(patch: Partial<ReviewData>) {
    const updated = { ...review, ...patch };
    setReview(updated);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => autoSave(updated), 1000);
  }

  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isComplete = !!(review.workedWell && review.biggestWin && review.nextWeekTop3);

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Revisión semanal</h1>
          <div className="flex items-center gap-2 mt-1">
            <button onClick={() => router.push(`/review?week=${getPrevWeek(weekStart)}`)}
              className="p-1 text-slate-400 hover:text-slate-600"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm text-slate-500 font-medium">{getWeekLabel(weekStart)}</span>
            <button
              onClick={() => router.push(`/review?week=${getNextWeek(weekStart)}`)}
              disabled={isCurrentWeek}
              className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
            ><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-emerald-600 font-medium">✓ Guardado</span>}
          {isComplete && <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold"><CheckCircle2 className="w-3.5 h-3.5" /> Completa</span>}
        </div>
      </div>

      {/* Step tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-2xl p-1">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              onClick={() => setStep(i)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-xs font-medium transition-all",
                i === step ? "bg-white text-[#1e3a5f] shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* Step content */}
      <div className="min-h-[400px]">
        {step === 0 && <StepStats stats={stats} weekStart={weekStart} />}
        {step === 1 && <StepEnergy review={review} onUpdate={update} />}
        {step === 2 && <StepWins review={review} onUpdate={update} stats={stats} />}
        {step === 3 && <StepReflect review={review} onUpdate={update} />}
        {step === 4 && <StepNext review={review} onUpdate={update} />}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4" /> Anterior
        </button>
        <button
          onClick={() => {
            if (isLast) {
              autoSave(review);
            } else {
              setStep((s) => s + 1);
            }
          }}
          className="flex items-center gap-2 px-5 py-2 bg-[#1e3a5f] text-white rounded-xl text-sm font-medium hover:bg-[#162d4a]"
        >
          {isLast ? "Finalizar revisión ✓" : (<>Siguiente <ChevronRight className="w-4 h-4" /></>)}
        </button>
      </div>
    </div>
  );
}

// ─── Step: Stats ─────────────────────────────────────────────────────────────

function StepStats({ stats, weekStart }: { stats: ReviewStats; weekStart: string }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">¿Cómo fue tu semana?</h2>
        <p className="text-sm text-slate-500">Aquí está un resumen automático de tu actividad.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: CheckCircle2, label: "Tareas completadas", value: stats.tasksDone, color: "text-emerald-600", bg: "bg-emerald-50" },
          { icon: Clock, label: "Tiempo registrado", value: stats.weekSeconds > 0 ? formatSeconds(stats.weekSeconds) : "—", color: "text-[#1e3a5f]", bg: "bg-[#1e3a5f]/5" },
          { icon: Repeat2, label: "Hábitos logrados", value: stats.habitCompletions, color: "text-orange-500", bg: "bg-orange-50" },
          { icon: Target, label: "Objetivos activos", value: stats.activeObjectives, color: "text-purple-600", bg: "bg-purple-50" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={cn("rounded-2xl p-4 text-center", stat.bg)}>
              <Icon className={cn("w-5 h-5 mx-auto mb-2", stat.color)} />
              <p className={cn("text-2xl font-bold tabular-nums", stat.color)}>{stat.value}</p>
              <p className="text-xs text-slate-500 mt-1">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {stats.doneTasks.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Tareas completadas esta semana
          </h3>
          <div className="space-y-1.5">
            {stats.doneTasks.map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-sm text-slate-600">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                {t.title}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step: Energy ────────────────────────────────────────────────────────────

function StepEnergy({ review, onUpdate }: { review: ReviewData; onUpdate: (p: Partial<ReviewData>) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">¿Cómo fue tu energía esta semana?</h2>
        <p className="text-sm text-slate-500">Sé honesto — esto te ayudará a planear mejor la próxima.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {ENERGY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onUpdate({ energyLevel: opt.value })}
            className={cn(
              "flex flex-col items-center gap-2 p-5 rounded-2xl border-2 transition-all",
              review.energyLevel === opt.value ? opt.color + " scale-[1.02]" : "border-slate-200 bg-white hover:border-slate-300"
            )}
          >
            <span className="text-3xl">{opt.emoji}</span>
            <span className="font-semibold text-sm">{opt.label}</span>
          </button>
        ))}
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Valoración general de la semana</label>
        <div className="flex gap-3">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => onUpdate({ overallRating: String(n) })}
              className="flex-1"
            >
              <Star className={cn(
                "w-8 h-8 mx-auto transition-all",
                Number(review.overallRating) >= n ? "fill-amber-400 text-amber-400 scale-110" : "text-slate-300 hover:text-amber-300"
              )} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Step: Wins ──────────────────────────────────────────────────────────────

function StepWins({ review, onUpdate, stats }: { review: ReviewData; onUpdate: (p: Partial<ReviewData>) => void; stats: ReviewStats }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">Victorias de la semana 🏆</h2>
        <p className="text-sm text-slate-500">Reconoce tus logros, por pequeños que sean.</p>
      </div>

      <ReviewTextarea
        label="¿Cuál fue tu mayor victoria esta semana?"
        placeholder="Esta semana logré..."
        value={review.biggestWin ?? ""}
        onChange={(v) => onUpdate({ biggestWin: v })}
        rows={3}
        required
      />

      <ReviewTextarea
        label="¿Qué funcionó bien?"
        placeholder="Lo que funcionó fue..."
        value={review.workedWell ?? ""}
        onChange={(v) => onUpdate({ workedWell: v })}
        rows={4}
        required
      />
    </div>
  );
}

// ─── Step: Reflect ───────────────────────────────────────────────────────────

function StepReflect({ review, onUpdate }: { review: ReviewData; onUpdate: (p: Partial<ReviewData>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">Reflexión honesta</h2>
        <p className="text-sm text-slate-500">Identifica lo que no salió bien para mejorar.</p>
      </div>

      <ReviewTextarea
        label="¿Qué no funcionó o te frenó?"
        placeholder="Lo que no funcionó fue..."
        value={review.didntWork ?? ""}
        onChange={(v) => onUpdate({ didntWork: v })}
        rows={4}
      />

      <ReviewTextarea
        label="¿Cuál fue la lección más importante de esta semana?"
        placeholder="Aprendí que..."
        value={review.mainLesson ?? ""}
        onChange={(v) => onUpdate({ mainLesson: v })}
        rows={3}
      />
    </div>
  );
}

// ─── Step: Next ──────────────────────────────────────────────────────────────

function StepNext({ review, onUpdate }: { review: ReviewData; onUpdate: (p: Partial<ReviewData>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">La próxima semana 🎯</h2>
        <p className="text-sm text-slate-500">Define tus 3 prioridades más importantes para la semana que viene.</p>
      </div>

      <div className="bg-[#1e3a5f]/5 rounded-2xl p-5 border border-[#1e3a5f]/10">
        <label className="block text-sm font-semibold text-[#1e3a5f] mb-3">Mis top 3 prioridades *</label>
        <textarea
          value={review.nextWeekTop3 ?? ""}
          onChange={(e) => onUpdate({ nextWeekTop3: e.target.value })}
          rows={5}
          placeholder={"1. \n2. \n3. "}
          className="w-full text-sm text-slate-800 placeholder-slate-300 resize-none focus:outline-none bg-transparent leading-relaxed"
        />
      </div>

      <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
        <p className="text-sm font-semibold text-amber-800 mb-1">🌟 Consejo de cierre</p>
        <p className="text-xs text-amber-700">Comparte o escribe dónde vas a pegar estas 3 prioridades para verlas cada mañana. La visibilidad = acción.</p>
      </div>
    </div>
  );
}

// ─── ReviewTextarea ───────────────────────────────────────────────────────────

function ReviewTextarea({ label, placeholder, value, onChange, rows, required }: {
  label: string; placeholder: string; value: string;
  onChange: (v: string) => void; rows: number; required?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <label className="block text-sm font-semibold text-slate-700 mb-3">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full text-sm text-slate-800 placeholder-slate-300 resize-none focus:outline-none leading-relaxed"
      />
    </div>
  );
}
