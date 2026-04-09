"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, X, Pencil, Trash2, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export type MealEntryRow = {
  id: string;
  planId: string;
  userId: string;
  dayOfWeek: number;
  mealTime: "desayuno" | "comida" | "cena" | "snack";
  name: string;
  estimatedCost: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

// ── Config ────────────────────────────────────────────────────────────────────

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const DAYS_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const MEAL_TIMES: { key: MealEntryRow["mealTime"]; label: string; emoji: string; color: string }[] = [
  { key: "desayuno", label: "Desayuno", emoji: "🌅", color: "bg-amber-50 border-amber-100" },
  { key: "comida",   label: "Comida",   emoji: "☀️", color: "bg-emerald-50 border-emerald-100" },
  { key: "cena",     label: "Cena",     emoji: "🌙", color: "bg-indigo-50 border-indigo-100" },
  { key: "snack",    label: "Snack",    emoji: "🍎", color: "bg-rose-50 border-rose-100" },
];

const MEAL_SUGGESTIONS = [
  "Avena con fruta", "Huevos revueltos", "Chilaquiles", "Yogur con granola",
  "Torta", "Tacos", "Sopa de verduras", "Arroz con pollo", "Pasta", "Ensalada",
  "Caldo de res", "Pozole", "Pizza", "Sándwich", "Quesadillas", "Fruta",
  "Tamales", "Enchiladas", "Frijoles con queso", "Pan dulce",
];

// ── Week helpers ───────────────────────────────────────────────────────────────

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun,1=Mon...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toISO(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function weekLabel(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return `${monday.toLocaleDateString("es-MX", opts)} – ${sunday.toLocaleDateString("es-MX", opts)}`;
}

// ── Entry Modal ───────────────────────────────────────────────────────────────

function EntryModal({
  entry,
  dayOfWeek,
  mealTime,
  weekStart,
  onClose,
  onSaved,
  onDeleted,
}: {
  entry: MealEntryRow | null;
  dayOfWeek: number;
  mealTime: MealEntryRow["mealTime"];
  weekStart: string;
  onClose: () => void;
  onSaved: (e: MealEntryRow) => void;
  onDeleted?: (id: string) => void;
}) {
  const isEdit = !!entry;
  const [name, setName]           = useState(entry?.name ?? "");
  const [cost, setCost]           = useState(entry?.estimatedCost ?? "");
  const [notes, setNotes]         = useState(entry?.notes ?? "");
  const [saving, setSaving]       = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const mealCfg = MEAL_TIMES.find((m) => m.key === mealTime)!;
  const filtered = MEAL_SUGGESTIONS.filter((s) =>
    name.length >= 2 && s.toLowerCase().includes(name.toLowerCase())
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        estimatedCost: cost ? parseFloat(cost) : null,
        notes: notes.trim() || null,
        ...(isEdit ? {} : { dayOfWeek, mealTime }),
      };
      const res = isEdit
        ? await fetch(`/api/meal-plans/${weekStart}/entries/${entry!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/meal-plans/${weekStart}/entries`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (res.ok) onSaved(await res.json());
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!entry || !onDeleted) return;
    setSaving(true);
    await fetch(`/api/meal-plans/${weekStart}/entries/${entry.id}`, { method: "DELETE" });
    onDeleted(entry.id);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className={cn("flex items-center justify-between px-5 py-4 rounded-t-2xl border-b", mealCfg.color)}>
          <div className="flex items-center gap-2">
            <span className="text-xl">{mealCfg.emoji}</span>
            <div>
              <p className="font-semibold text-slate-800 text-sm">{mealCfg.label}</p>
              <p className="text-xs text-slate-500">{DAYS[dayOfWeek]}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {/* Name + autocomplete */}
          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1">Platillo *</label>
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => { setName(e.target.value); setShowSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Ej: Tacos de canasta, Ensalada..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
              required
            />
            {showSuggestions && filtered.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                {filtered.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => { setName(s); setShowSuggestions(false); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cost */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Costo estimado
              <span className="text-xs font-normal text-slate-400 ml-1">(MXN)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
              <input
                type="number"
                step="any"
                min="0"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="0.00"
                className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 text-right"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notas</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ingredientes clave, dónde comprar..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {isEdit && onDeleted && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="px-3 py-2 rounded-lg text-red-500 hover:bg-red-50 border border-red-100 text-sm transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex-1 px-4 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#162d4a] transition-colors disabled:opacity-50"
            >
              {saving ? "..." : isEdit ? "Guardar" : "Agregar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Meal Cell ─────────────────────────────────────────────────────────────────

function MealCell({
  entries,
  dayOfWeek,
  mealTime,
  onAdd,
  onEdit,
}: {
  entries: MealEntryRow[];
  dayOfWeek: number;
  mealTime: MealEntryRow["mealTime"];
  onAdd: () => void;
  onEdit: (e: MealEntryRow) => void;
}) {
  const dayEntries = entries.filter(
    (e) => e.dayOfWeek === dayOfWeek && e.mealTime === mealTime
  );
  const cfg = MEAL_TIMES.find((m) => m.key === mealTime)!;

  return (
    <div className="min-h-[56px] flex flex-col gap-1">
      {dayEntries.map((e) => (
        <button
          key={e.id}
          onClick={() => onEdit(e)}
          className="group w-full text-left px-2.5 py-1.5 rounded-lg bg-white border border-slate-100 hover:border-slate-300 hover:shadow-sm transition-all"
        >
          <p className="text-xs font-medium text-slate-800 leading-tight truncate">{e.name}</p>
          {e.estimatedCost && (
            <p className="text-[10px] text-slate-400 mt-0.5">
              ${parseFloat(e.estimatedCost).toLocaleString("es-MX", { minimumFractionDigits: 0 })}
            </p>
          )}
        </button>
      ))}
      <button
        onClick={onAdd}
        className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-dashed border-slate-200 text-slate-300 hover:border-slate-400 hover:text-slate-500 transition-all text-xs"
      >
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
}

// ── Weekly Summary ────────────────────────────────────────────────────────────

function WeeklySummary({ entries }: { entries: MealEntryRow[] }) {
  const withCost = entries.filter((e) => e.estimatedCost != null);
  if (withCost.length === 0) return null;

  const totalWeek = withCost.reduce((s, e) => s + parseFloat(e.estimatedCost!), 0);

  // Daily totals
  const byDay = DAYS.map((_, i) => ({
    label: DAYS_SHORT[i],
    total: entries
      .filter((e) => e.dayOfWeek === i && e.estimatedCost != null)
      .reduce((s, e) => s + parseFloat(e.estimatedCost!), 0),
  }));

  const maxDay = Math.max(...byDay.map((d) => d.total), 1);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-900">Costo estimado semanal</h2>
        <div className="text-right">
          <p className="text-xs text-slate-400">Total</p>
          <p className="text-xl font-bold text-slate-900">
            ${totalWeek.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            <span className="text-xs font-normal text-slate-400 ml-1">MXN</span>
          </p>
        </div>
      </div>

      {/* Daily bars */}
      <div className="flex items-end gap-2 h-20">
        {byDay.map(({ label, total }) => (
          <div key={label} className="flex-1 flex flex-col items-center gap-1">
            <p className="text-[10px] text-slate-500 tabular-nums">
              {total > 0 ? `$${total.toLocaleString("es-MX", { maximumFractionDigits: 0 })}` : ""}
            </p>
            <div className="w-full bg-slate-100 rounded-full flex items-end overflow-hidden" style={{ height: "40px" }}>
              <div
                className="w-full bg-[#1e3a5f] rounded-full transition-all"
                style={{ height: `${maxDay > 0 ? (total / maxDay) * 100 : 0}%`, minHeight: total > 0 ? "4px" : "0" }}
              />
            </div>
            <p className="text-[10px] text-slate-400">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-50 flex justify-between text-xs text-slate-400">
        <span>{withCost.length} platillos con costo</span>
        <span>Promedio por día: ${(totalWeek / 7).toLocaleString("es-MX", { maximumFractionDigits: 0 })}</span>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function MealPlanner({
  initialEntries,
  initialWeekStart,
}: {
  initialEntries: MealEntryRow[];
  initialWeekStart: string;
}) {
  const router = useRouter();
  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const [entries, setEntries]     = useState<MealEntryRow[]>(initialEntries);
  const [loading, setLoading]     = useState(false);

  // Modal state
  const [modal, setModal] = useState<{
    entry: MealEntryRow | null;
    dayOfWeek: number;
    mealTime: MealEntryRow["mealTime"];
  } | null>(null);

  async function loadWeek(ws: string) {
    setLoading(true);
    setWeekStart(ws);
    try {
      const res = await fetch(`/api/meal-plans/${ws}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries ?? []);
      } else {
        setEntries([]);
      }
    } finally {
      setLoading(false);
    }
  }

  function prevWeek() {
    const d = new Date(weekStart + "T12:00:00");
    d.setDate(d.getDate() - 7);
    loadWeek(toISO(d));
  }

  function nextWeek() {
    const d = new Date(weekStart + "T12:00:00");
    d.setDate(d.getDate() + 7);
    loadWeek(toISO(d));
  }

  function goToday() {
    loadWeek(toISO(getMondayOf(new Date())));
  }

  function openAdd(dayOfWeek: number, mealTime: MealEntryRow["mealTime"]) {
    setModal({ entry: null, dayOfWeek, mealTime });
  }

  function openEdit(entry: MealEntryRow) {
    setModal({ entry, dayOfWeek: entry.dayOfWeek, mealTime: entry.mealTime });
  }

  function handleSaved(saved: MealEntryRow) {
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved];
    });
    setModal(null);
  }

  function handleDeleted(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setModal(null);
  }

  const monday = new Date(weekStart + "T12:00:00");
  const isThisWeek = weekStart === toISO(getMondayOf(new Date()));

  // Day dates (Mon–Sun)
  const dayDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d.getDate();
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Plan de comidas</h1>
          <p className="text-sm text-slate-500 mt-0.5">{weekLabel(monday)}</p>
        </div>
        {!isThisWeek && (
          <button
            onClick={goToday}
            className="px-4 py-2 text-sm border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Esta semana
          </button>
        )}
      </div>

      {/* Week navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={prevWeek}
          className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 text-center">
          <p className="text-sm font-medium text-slate-700">
            {weekLabel(monday)}
            {isThisWeek && <span className="ml-2 text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">Esta semana</span>}
          </p>
        </div>
        <button
          onClick={nextWeek}
          className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Grid */}
      <div className={cn("transition-opacity", loading && "opacity-40 pointer-events-none")}>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-8 border-b border-slate-100">
            <div className="p-3" /> {/* meal time column */}
            {DAYS.map((day, i) => (
              <div key={day} className="p-3 text-center border-l border-slate-50">
                <p className="text-xs font-semibold text-slate-600 hidden sm:block">{day}</p>
                <p className="text-xs font-semibold text-slate-600 sm:hidden">{DAYS_SHORT[i]}</p>
                <p className={cn(
                  "text-xs mt-0.5 w-6 h-6 rounded-full flex items-center justify-center mx-auto",
                  dayDates[i] === new Date().getDate() && isThisWeek
                    ? "bg-[#1e3a5f] text-white font-bold"
                    : "text-slate-400"
                )}>
                  {dayDates[i]}
                </p>
              </div>
            ))}
          </div>

          {/* Meal rows */}
          {MEAL_TIMES.map((mt, ri) => (
            <div
              key={mt.key}
              className={cn(
                "grid grid-cols-8",
                ri < MEAL_TIMES.length - 1 && "border-b border-slate-50"
              )}
            >
              {/* Meal time label */}
              <div className={cn("p-3 flex flex-col items-center justify-center gap-1 border-r border-slate-50", mt.color)}>
                <span className="text-lg">{mt.emoji}</span>
                <p className="text-[10px] font-medium text-slate-500 text-center hidden sm:block">{mt.label}</p>
              </div>

              {/* Day cells */}
              {DAYS.map((_, dayIdx) => (
                <div key={dayIdx} className="p-2 border-l border-slate-50">
                  <MealCell
                    entries={entries}
                    dayOfWeek={dayIdx}
                    mealTime={mt.key}
                    onAdd={() => openAdd(dayIdx, mt.key)}
                    onEdit={openEdit}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Weekly cost summary */}
      <WeeklySummary entries={entries} />

      {/* Modal */}
      {modal && (
        <EntryModal
          entry={modal.entry}
          dayOfWeek={modal.dayOfWeek}
          mealTime={modal.mealTime}
          weekStart={weekStart}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
