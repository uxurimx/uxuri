"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Save, BookOpen, Smile } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

export type JournalEntry = {
  id?: string;
  date: string;
  mood?: number | null;
  intention?: string | null;
  gratitude?: string | null;
  wins?: string | null;
  reflection?: string | null;
};

export type JournalListItem = {
  id: string;
  date: string;
  mood?: number | null;
  intention?: string | null;
  wins?: string | null;
};

// ─── Config ──────────────────────────────────────────────────────────────────

const MOODS = [
  { value: 1, emoji: "😞", label: "Mal" },
  { value: 2, emoji: "😕", label: "Regular" },
  { value: 3, emoji: "😐", label: "Normal" },
  { value: 4, emoji: "🙂", label: "Bien" },
  { value: 5, emoji: "😄", label: "Excelente" },
];

const MOOD_COLORS: Record<number, string> = {
  1: "text-red-500 bg-red-50 border-red-200",
  2: "text-orange-500 bg-orange-50 border-orange-200",
  3: "text-slate-500 bg-slate-50 border-slate-200",
  4: "text-blue-500 bg-blue-50 border-blue-200",
  5: "text-emerald-500 bg-emerald-50 border-emerald-200",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function formatDateLong(dateStr: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(new Date(dateStr + "T12:00:00"));
}

// ─── Component ───────────────────────────────────────────────────────────────

interface JournalEditorProps {
  initialEntry: JournalEntry | null;
  recentEntries: JournalListItem[];
  todayStr: string;
  dateStr: string;
}

export function JournalEditor({ initialEntry, recentEntries, todayStr, dateStr }: JournalEditorProps) {
  const router = useRouter();
  const [entry, setEntry] = useState<JournalEntry>(initialEntry ?? { date: dateStr });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);

  // Auto-save with debounce
  const autoSave = useCallback(async (data: JournalEntry) => {
    setSaving(true);
    try {
      await fetch(`/api/journal/${data.date}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }, []);

  function scheduleAutoSave(updated: JournalEntry) {
    setEntry(updated);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => autoSave(updated), 1200);
  }

  useEffect(() => () => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
  }, []);

  const isToday = dateStr === todayStr;
  const prevDate = addDays(dateStr, -1);
  const nextDate = addDays(dateStr, 1);
  const canGoNext = nextDate <= todayStr;

  const moodEntry = entry.mood ? MOODS.find((m) => m.value === entry.mood) : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-[#1e3a5f]" />
          <div>
            <h1 className="text-xl font-bold text-slate-900 capitalize">{formatDateLong(dateStr)}</h1>
            {isToday && <span className="text-xs text-emerald-600 font-medium">Hoy</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs text-slate-400">Guardando...</span>}
          {saved && <span className="text-xs text-emerald-600 font-medium">✓ Guardado</span>}
          <button
            onClick={() => router.push(`/journal?date=${prevDate}`)}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => router.push(`/journal?date=${nextDate}`)}
            disabled={!canGoNext}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {!isToday && (
            <button
              onClick={() => router.push("/journal")}
              className="px-3 py-1.5 text-xs bg-[#1e3a5f] text-white rounded-lg hover:bg-[#162d4a]"
            >
              Ir a hoy
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Main editor ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Mood */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Smile className="w-4 h-4" />
              ¿Cómo te sientes hoy?
            </h3>
            <div className="flex gap-3">
              {MOODS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => scheduleAutoSave({ ...entry, mood: entry.mood === m.value ? null : m.value })}
                  className={cn(
                    "flex flex-col items-center gap-1 px-3 py-2 rounded-xl border-2 transition-all flex-1",
                    entry.mood === m.value
                      ? MOOD_COLORS[m.value]
                      : "border-slate-100 hover:border-slate-200 text-slate-400"
                  )}
                >
                  <span className="text-2xl">{m.emoji}</span>
                  <span className="text-xs font-medium">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Intención */}
          <JournalSection
            title="🎯 Intención del día"
            subtitle="¿Qué quiero lograr hoy?"
            value={entry.intention ?? ""}
            onChange={(v) => scheduleAutoSave({ ...entry, intention: v })}
            placeholder="Mi principal intención para hoy es..."
            rows={3}
          />

          {/* Gratitud */}
          <JournalSection
            title="🙏 Gratitud"
            subtitle="3 cosas por las que estoy agradecido"
            value={entry.gratitude ?? ""}
            onChange={(v) => scheduleAutoSave({ ...entry, gratitude: v })}
            placeholder={"1. \n2. \n3. "}
            rows={4}
          />

          {/* Victorias */}
          <JournalSection
            title="🏆 Victorias del día"
            subtitle="¿Qué logré hoy? (no importa el tamaño)"
            value={entry.wins ?? ""}
            onChange={(v) => scheduleAutoSave({ ...entry, wins: v })}
            placeholder="Hoy logré..."
            rows={3}
          />

          {/* Reflexión */}
          <JournalSection
            title="✍️ Reflexión libre"
            subtitle="Pensamientos, aprendizajes, ideas..."
            value={entry.reflection ?? ""}
            onChange={(v) => scheduleAutoSave({ ...entry, reflection: v })}
            placeholder="Hoy pensé en..."
            rows={6}
          />
        </div>

        {/* ── Sidebar: recent entries ── */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Entradas recientes</h3>
            {recentEntries.length === 0 ? (
              <p className="text-xs text-slate-400">Aún no hay entradas</p>
            ) : (
              <div className="space-y-1.5">
                {recentEntries.map((e) => {
                  const isActive = e.date === dateStr;
                  const mood = e.mood ? MOODS.find((m) => m.value === e.mood) : null;
                  return (
                    <button
                      key={e.date}
                      onClick={() => router.push(`/journal?date=${e.date}`)}
                      className={cn(
                        "w-full text-left px-3 py-2.5 rounded-xl border transition-all",
                        isActive
                          ? "border-[#1e3a5f]/30 bg-[#1e3a5f]/5"
                          : "border-transparent hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-700 capitalize">
                          {new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short" }).format(new Date(e.date + "T12:00:00"))}
                        </span>
                        {mood && <span className="text-base">{mood.emoji}</span>}
                      </div>
                      {e.intention && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{e.intention}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Mood streak / stats */}
          {recentEntries.some((e) => e.mood) && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Ánimo últimos 7 días</h3>
              <div className="flex gap-1.5 items-end justify-between">
                {recentEntries.slice(0, 7).reverse().map((e) => {
                  const mood = e.mood ?? 0;
                  const heights = ["h-2", "h-4", "h-6", "h-8", "h-10"];
                  const colors = ["bg-red-400", "bg-orange-400", "bg-slate-300", "bg-blue-400", "bg-emerald-400"];
                  return (
                    <div key={e.date} className="flex flex-col items-center gap-1 flex-1">
                      <div className={cn("w-full rounded-sm", mood > 0 ? heights[mood - 1] : "h-1", mood > 0 ? colors[mood - 1] : "bg-slate-100")} />
                      <span className="text-[10px] text-slate-400">
                        {new Intl.DateTimeFormat("es-ES", { weekday: "narrow" }).format(new Date(e.date + "T12:00:00"))}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── JournalSection ───────────────────────────────────────────────────────────

function JournalSection({
  title, subtitle, value, onChange, placeholder, rows,
}: {
  title: string; subtitle: string; value: string;
  onChange: (v: string) => void; placeholder: string; rows: number;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
      </div>
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
