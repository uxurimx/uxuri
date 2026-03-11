"use client";

import { useState, useOptimistic, useTransition } from "react";
import { Plus, Flame, X, Pencil, Check, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

export type HabitWithStats = {
  id: string;
  title: string;
  description: string | null;
  frequency: "daily" | "weekdays" | "weekends" | "weekly";
  color: string;
  icon: string;
  streak: number;
  doneToday: boolean;
  last7: { date: string; done: boolean }[];
};

const EMOJI_OPTIONS = ["✅", "🏃", "📚", "💪", "🧘", "🥗", "💧", "🛌", "✍️", "🎯", "🧠", "🚴", "🎵", "🌿", "🙏"];
const COLOR_OPTIONS = ["#1e3a5f", "#059669", "#d97706", "#dc2626", "#7c3aed", "#db2777", "#0284c7", "#65a30d"];
const FREQ_LABELS = { daily: "Diario", weekdays: "Días laborales", weekends: "Fines de semana", weekly: "Semanal" };

// ─── Component ───────────────────────────────────────────────────────────────

interface HabitsClientProps {
  initialHabits: HabitWithStats[];
  todayStr: string;
}

export function HabitsClient({ initialHabits, todayStr }: HabitsClientProps) {
  const [habits, setHabits] = useState<HabitWithStats[]>(initialHabits);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // ── Create form state ──
  const [newTitle, setNewTitle] = useState("");
  const [newIcon, setNewIcon] = useState("✅");
  const [newColor, setNewColor] = useState("#1e3a5f");
  const [newFreq, setNewFreq] = useState<"daily" | "weekdays" | "weekends" | "weekly">("daily");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  // ── Edit form state ──
  const [editTitle, setEditTitle] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editFreq, setEditFreq] = useState<"daily" | "weekdays" | "weekends" | "weekly">("daily");

  // ── Toggle (optimistic) ──
  async function handleToggle(habit: HabitWithStats) {
    const wasDown = habit.doneToday;

    // Optimistic update
    setHabits((prev) =>
      prev.map((h) =>
        h.id === habit.id
          ? {
              ...h,
              doneToday: !wasDown,
              streak: !wasDown ? h.streak + 1 : Math.max(0, h.streak - 1),
              last7: h.last7.map((d) =>
                d.date === todayStr ? { ...d, done: !wasDown } : d
              ),
            }
          : h
      )
    );

    if (wasDown) {
      await fetch(`/api/habits/${habit.id}/log?date=${todayStr}`, { method: "DELETE" });
    } else {
      await fetch(`/api/habits/${habit.id}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: todayStr }),
      });
    }
  }

  // ── Create ──
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), description: newDesc || null, frequency: newFreq, icon: newIcon, color: newColor }),
      });
      if (res.ok) {
        const habit = await res.json();
        setHabits((prev) => [...prev, { ...habit, doneToday: false, streak: 0, last7: [] }]);
        setNewTitle(""); setNewDesc(""); setNewIcon("✅"); setNewColor("#1e3a5f"); setNewFreq("daily");
        setShowCreate(false);
      }
    } finally {
      setCreating(false);
    }
  }

  // ── Edit ──
  function startEdit(habit: HabitWithStats) {
    setEditingId(habit.id);
    setEditTitle(habit.title);
    setEditIcon(habit.icon);
    setEditColor(habit.color);
    setEditFreq(habit.frequency);
  }

  async function handleEdit(habitId: string) {
    await fetch(`/api/habits/${habitId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle, icon: editIcon, color: editColor, frequency: editFreq }),
    });
    setHabits((prev) =>
      prev.map((h) =>
        h.id === habitId ? { ...h, title: editTitle, icon: editIcon, color: editColor, frequency: editFreq } : h
      )
    );
    setEditingId(null);
  }

  // ── Archive ──
  async function handleArchive(habitId: string) {
    await fetch(`/api/habits/${habitId}`, { method: "DELETE" });
    setHabits((prev) => prev.filter((h) => h.id !== habitId));
  }

  const doneCount = habits.filter((h) => h.doneToday).length;
  const pct = habits.length > 0 ? Math.round((doneCount / habits.length) * 100) : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Hábitos</h1>
          <p className="text-sm text-slate-500 mt-0.5">Construye rutinas que te acerquen a tus metas</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#1e3a5f] text-white rounded-xl text-sm font-medium hover:bg-[#162d4a] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo hábito
        </button>
      </div>

      {/* Daily progress bar */}
      {habits.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-slate-700">Progreso de hoy</p>
              <p className="text-xs text-slate-400 mt-0.5">{doneCount} de {habits.length} hábitos completados</p>
            </div>
            <span className={cn(
              "text-2xl font-bold tabular-nums",
              pct === 100 ? "text-emerald-600" : pct >= 50 ? "text-[#1e3a5f]" : "text-slate-400"
            )}>{pct}%</span>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                pct === 100 ? "bg-emerald-500" : "bg-[#1e3a5f]"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          {pct === 100 && (
            <p className="text-sm text-emerald-600 font-medium mt-2 flex items-center gap-1.5">
              🎉 ¡Todos los hábitos completados hoy!
            </p>
          )}
        </div>
      )}

      {/* Habits list */}
      <div className="space-y-3">
        {habits.map((habit) => (
          <HabitCard
            key={habit.id}
            habit={habit}
            isEditing={editingId === habit.id}
            editTitle={editTitle}
            editIcon={editIcon}
            editColor={editColor}
            editFreq={editFreq}
            onToggle={() => handleToggle(habit)}
            onStartEdit={() => startEdit(habit)}
            onCancelEdit={() => setEditingId(null)}
            onSaveEdit={() => handleEdit(habit.id)}
            onArchive={() => handleArchive(habit.id)}
            onEditTitle={setEditTitle}
            onEditIcon={setEditIcon}
            onEditColor={setEditColor}
            onEditFreq={setEditFreq}
          />
        ))}

        {habits.length === 0 && !showCreate && (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 text-center">
            <div className="text-4xl mb-3">🌱</div>
            <p className="text-slate-600 font-medium">Aún no tienes hábitos</p>
            <p className="text-slate-400 text-sm mt-1">Crea tu primer hábito y empieza a construir tu rutina ideal</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 px-4 py-2 bg-[#1e3a5f] text-white rounded-xl text-sm hover:bg-[#162d4a] transition-colors"
            >
              + Crear primer hábito
            </button>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900">Nuevo hábito</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              {/* Icon + title row */}
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Icono</label>
                  <select
                    value={newIcon}
                    onChange={(e) => setNewIcon(e.target.value)}
                    className="w-16 px-2 py-2 border border-slate-200 rounded-lg text-lg text-center"
                  >
                    {EMOJI_OPTIONS.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Nombre *</label>
                  <input
                    autoFocus
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Ej: Meditar 10 minutos"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Descripción (opcional)</label>
                <input
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Notas adicionales..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                />
              </div>

              {/* Frequency */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Frecuencia</label>
                <select
                  value={newFreq}
                  onChange={(e) => setNewFreq(e.target.value as typeof newFreq)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  {Object.entries(FREQ_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>

              {/* Color */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-2">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewColor(c)}
                      className={cn("w-7 h-7 rounded-full border-2 transition-all", newColor === c ? "border-slate-700 scale-110" : "border-transparent")}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim() || creating}
                  className="flex-1 px-4 py-2 bg-[#1e3a5f] text-white rounded-xl text-sm font-medium hover:bg-[#162d4a] disabled:opacity-50"
                >
                  {creating ? "Creando..." : "Crear hábito"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── HabitCard ────────────────────────────────────────────────────────────────

function HabitCard({
  habit,
  isEditing,
  editTitle, editIcon, editColor, editFreq,
  onToggle, onStartEdit, onCancelEdit, onSaveEdit, onArchive,
  onEditTitle, onEditIcon, onEditColor, onEditFreq,
}: {
  habit: HabitWithStats;
  isEditing: boolean;
  editTitle: string; editIcon: string; editColor: string; editFreq: string;
  onToggle: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onArchive: () => void;
  onEditTitle: (v: string) => void;
  onEditIcon: (v: string) => void;
  onEditColor: (v: string) => void;
  onEditFreq: (v: "daily" | "weekdays" | "weekends" | "weekly") => void;
}) {
  const [showActions, setShowActions] = useState(false);

  if (isEditing) {
    return (
      <div className="bg-white rounded-2xl border-2 border-[#1e3a5f]/30 p-4 shadow-sm space-y-3">
        <div className="flex gap-3">
          <select
            value={editIcon}
            onChange={(e) => onEditIcon(e.target.value)}
            className="w-14 px-1 py-2 border border-slate-200 rounded-lg text-lg text-center"
          >
            {["✅","🏃","📚","💪","🧘","🥗","💧","🛌","✍️","🎯","🧠","🚴","🎵","🌿","🙏"].map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
          <input
            autoFocus
            value={editTitle}
            onChange={(e) => onEditTitle(e.target.value)}
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
          />
        </div>
        <select
          value={editFreq}
          onChange={(e) => onEditFreq(e.target.value as "daily" | "weekdays" | "weekends" | "weekly")}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
        >
          <option value="daily">Diario</option>
          <option value="weekdays">Días laborales</option>
          <option value="weekends">Fines de semana</option>
          <option value="weekly">Semanal</option>
        </select>
        <div className="flex gap-2">
          {["#1e3a5f","#059669","#d97706","#dc2626","#7c3aed","#db2777","#0284c7","#65a30d"].map((c) => (
            <button key={c} type="button" onClick={() => onEditColor(c)}
              className={cn("w-6 h-6 rounded-full border-2 transition-all", editColor === c ? "border-slate-700 scale-110" : "border-transparent")}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onCancelEdit} className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button onClick={onSaveEdit} className="flex-1 px-3 py-1.5 bg-[#1e3a5f] text-white rounded-lg text-sm hover:bg-[#162d4a]">Guardar</button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "bg-white rounded-2xl border p-4 shadow-sm transition-all group",
      habit.doneToday ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200"
    )}>
      <div className="flex items-center gap-3">
        {/* Toggle button */}
        <button
          onClick={onToggle}
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0 transition-all border-2",
            habit.doneToday
              ? "border-emerald-400 bg-emerald-100 scale-95"
              : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
          )}
          style={habit.doneToday ? { borderColor: habit.color, backgroundColor: habit.color + "20" } : {}}
        >
          {habit.doneToday ? <Check className="w-5 h-5" style={{ color: habit.color }} /> : <span>{habit.icon}</span>}
        </button>

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <p className={cn("font-medium text-sm", habit.doneToday ? "text-slate-500 line-through" : "text-slate-900")}>
            {habit.title}
          </p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-slate-400">{FREQ_LABELS[habit.frequency]}</span>
            {habit.streak > 0 && (
              <span className="flex items-center gap-0.5 text-xs font-semibold text-orange-500">
                <Flame className="w-3 h-3" />
                {habit.streak}
              </span>
            )}
          </div>
        </div>

        {/* Last 7 days heatmap */}
        <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
          {habit.last7.map((day) => (
            <div
              key={day.date}
              title={day.date}
              className={cn("w-5 h-5 rounded-md border", day.done ? "border-transparent" : "border-slate-200 bg-slate-50")}
              style={day.done ? { backgroundColor: habit.color + "60", borderColor: habit.color } : {}}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={onStartEdit} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onArchive} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
