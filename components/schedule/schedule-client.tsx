"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Check, ChevronLeft, ChevronRight, Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { getPusherClient } from "@/lib/pusher";

// ─── Types ───────────────────────────────────────────────────────────────────

export type Block = {
  id: string;
  title: string;
  startMinutes: number;
  endMinutes: number;
  color: string;
  notes: string | null;
  done: boolean;
  taskId: string | null;
  date: string;
};

export type TaskOption = { id: string; title: string; projectName: string | null };
export type View = "day" | "week" | "month" | "year";

const BLOCK_COLORS = [
  "#1e3a5f", "#0284c7", "#059669", "#d97706",
  "#dc2626", "#7c3aed", "#db2777", "#475569",
];

// ─── Constants ────────────────────────────────────────────────────────────────

const PX_PER_MIN = 1.8;
const WEEK_PX = 0.75;
const TOTAL_MINS = 24 * 60;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function minsToTime(mins: number) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function timeToMins(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().split("T")[0];
}

function getWeekDates(dateStr: string): string[] {
  const start = getWeekStart(dateStr);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

function addMonths(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setMonth(d.getMonth() + n);
  return d.toISOString().split("T")[0];
}

function addYears(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setFullYear(d.getFullYear() + n);
  return d.toISOString().split("T")[0];
}

function formatDayLong(dateStr: string) {
  return new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" })
    .format(new Date(dateStr + "T12:00:00"));
}

function formatWeekRange(dateStr: string) {
  const start = getWeekStart(dateStr);
  const end = addDays(start, 6);
  const fmt = (d: string) =>
    new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(new Date(d + "T12:00:00"));
  const year = new Date(end + "T12:00:00").getFullYear();
  return `${fmt(start)} – ${fmt(end)}, ${year}`;
}

function formatMonth(dateStr: string) {
  return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" })
    .format(new Date(dateStr + "T12:00:00"));
}

function formatYear(dateStr: string) {
  return dateStr.slice(0, 4);
}

function navDate(view: View, dateStr: string, dir: 1 | -1): string {
  if (view === "day") return addDays(dateStr, dir);
  if (view === "week") return addDays(dateStr, 7 * dir);
  if (view === "month") return addMonths(dateStr, dir);
  return addYears(dateStr, dir);
}

// ─── Color picker ────────────────────────────────────────────────────────────

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex gap-2">
      {BLOCK_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={cn("w-7 h-7 rounded-full border-2 transition-all", value === c ? "border-slate-600 scale-110" : "border-transparent")}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}

// ─── DayView ─────────────────────────────────────────────────────────────────

function DayView({ blocks, dateStr, todayStr, onToggleDone, onDelete, onEdit, onOpenCreate }: {
  blocks: Block[];
  dateStr: string;
  todayStr: string;
  onToggleDone: (b: Block) => void;
  onDelete: (id: string) => void;
  onEdit: (b: Block) => void;
  onOpenCreate: () => void;
}) {
  const totalPx = TOTAL_MINS * PX_PER_MIN;
  const isToday = dateStr === todayStr;
  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-y-auto" style={{ maxHeight: "75vh" }}>
            <div className="relative" style={{ height: `${totalPx}px` }}>
              {/* Hour lines */}
              {Array.from({ length: 25 }).map((_, i) => (
                <div key={i} className="absolute left-0 right-0 flex items-center" style={{ top: `${i * 60 * PX_PER_MIN}px` }}>
                  <span className="w-16 text-xs text-slate-400 text-right pr-3 flex-shrink-0 select-none">
                    {i < 24 ? `${String(i).padStart(2, "0")}:00` : ""}
                  </span>
                  <div className="flex-1 border-t border-slate-100" />
                </div>
              ))}

              {/* Now indicator */}
              {isToday && (
                <div className="absolute left-16 right-0 flex items-center z-20 pointer-events-none" style={{ top: `${currentMins * PX_PER_MIN}px` }}>
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.5 flex-shrink-0" />
                  <div className="flex-1 border-t-2 border-red-400" />
                </div>
              )}

              {/* Blocks */}
              {blocks.map((block) => {
                const y = block.startMinutes * PX_PER_MIN;
                const h = Math.max((block.endMinutes - block.startMinutes) * PX_PER_MIN, 24);
                const isShort = h < 40;
                return (
                  <div
                    key={block.id}
                    className={cn("absolute right-3 rounded-lg px-2.5 py-1.5 group cursor-pointer transition-opacity hover:brightness-95", block.done && "opacity-60")}
                    style={{ top: `${y + 1}px`, height: `${h - 2}px`, backgroundColor: block.color + "20", borderLeft: `3px solid ${block.color}`, left: "68px" }}
                    onClick={() => onEdit(block)}
                  >
                    <div className={cn("flex items-start", isShort ? "gap-1" : "gap-2")}>
                      <button
                        onClick={(e) => { e.stopPropagation(); onToggleDone(block); }}
                        className="flex-shrink-0 mt-0.5"
                      >
                        <div className={cn("w-3.5 h-3.5 rounded border-2 flex items-center justify-center", block.done ? "border-current bg-current" : "border-current/50")} style={{ color: block.color }}>
                          {block.done && <Check className="w-2 h-2 text-white" />}
                        </div>
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-xs font-semibold leading-tight", block.done && "line-through")} style={{ color: block.color }}>{block.title}</p>
                        {!isShort && <p className="text-xs text-slate-500 mt-0.5">{minsToTime(block.startMinutes)} – {minsToTime(block.endMinutes)}</p>}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(block.id); }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-red-500 transition-all flex-shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Lista de bloques</h3>
        {blocks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-6 text-center">
            <p className="text-sm text-slate-400">Sin bloques</p>
            <button onClick={onOpenCreate} className="mt-2 text-xs text-[#1e3a5f] hover:underline">+ Agregar bloque</button>
          </div>
        ) : (
          <div className="space-y-2">
            {blocks.map((block) => (
              <div
                key={block.id}
                className={cn("bg-white rounded-xl border p-3 flex items-center gap-3 group cursor-pointer hover:bg-slate-50 transition-colors", block.done ? "border-slate-100 opacity-60" : "border-slate-200")}
                onClick={() => onEdit(block)}
              >
                <button onClick={(e) => { e.stopPropagation(); onToggleDone(block); }}>
                  <div className={cn("w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0", block.done ? "border-current bg-current" : "border-current/40")} style={{ color: block.color }}>
                    {block.done && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                </button>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium text-slate-800", block.done && "line-through")}>{block.title}</p>
                  <p className="text-xs text-slate-400">{minsToTime(block.startMinutes)} – {minsToTime(block.endMinutes)}</p>
                </div>
                <Pencil className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 flex-shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── WeekView ─────────────────────────────────────────────────────────────────

function WeekView({ blocksMap, weekDates, todayStr, onDayCreate, onBlockEdit, onDayNav }: {
  blocksMap: Record<string, Block[]>;
  weekDates: string[];
  todayStr: string;
  onDayCreate: (d: string) => void;
  onBlockEdit: (b: Block) => void;
  onDayNav: (d: string) => void;
}) {
  const totalPx = TOTAL_MINS * WEEK_PX;
  const currentMins = new Date().getHours() * 60 + new Date().getMinutes();

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Day headers */}
      <div className="flex border-b border-slate-100 sticky top-0 bg-white z-10">
        <div className="w-14 flex-shrink-0" />
        {weekDates.map((d) => {
          const dt = new Date(d + "T12:00:00");
          const isToday = d === todayStr;
          return (
            <div key={d} className={cn("flex-1 text-center py-2 border-l border-slate-100", isToday && "bg-blue-50")}>
              <p className="text-xs text-slate-400 capitalize">{new Intl.DateTimeFormat("es-ES", { weekday: "short" }).format(dt)}</p>
              <button
                className={cn("mx-auto mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold hover:ring-2 hover:ring-[#1e3a5f]/30 transition-all", isToday ? "bg-[#1e3a5f] text-white" : "text-slate-700 hover:bg-slate-100")}
                onClick={() => onDayNav(d)}
                title="Ver día"
              >
                {dt.getDate()}
              </button>
            </div>
          );
        })}
      </div>

      {/* Timeline */}
      <div className="overflow-y-auto" style={{ maxHeight: "72vh" }}>
        <div className="relative flex" style={{ height: `${totalPx}px` }}>
          {/* Time labels */}
          <div className="w-14 flex-shrink-0 relative">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="absolute right-2 text-xs text-slate-400 select-none" style={{ top: `${i * 60 * WEEK_PX - 7}px` }}>
                {`${String(i).padStart(2, "0")}:00`}
              </div>
            ))}
          </div>

          {/* Hour lines */}
          <div className="absolute inset-0 left-14 pointer-events-none">
            {Array.from({ length: 25 }).map((_, i) => (
              <div key={i} className="absolute left-0 right-0 border-t border-slate-100" style={{ top: `${i * 60 * WEEK_PX}px` }} />
            ))}
          </div>

          {/* Day columns */}
          {weekDates.map((d) => {
            const dayBlocks = blocksMap[d] ?? [];
            const isToday = d === todayStr;
            return (
              <div
                key={d}
                className={cn("flex-1 border-l border-slate-100 relative cursor-pointer hover:bg-slate-50/50 transition-colors", isToday && "bg-blue-50/30")}
                onClick={() => onDayCreate(d)}
              >
                {/* Now line in today's column */}
                {isToday && (
                  <div className="absolute left-0 right-0 z-20 pointer-events-none flex items-center" style={{ top: `${currentMins * WEEK_PX}px` }}>
                    <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 flex-shrink-0" />
                    <div className="flex-1 border-t-2 border-red-400" />
                  </div>
                )}
                {dayBlocks.map((block) => {
                  const y = block.startMinutes * WEEK_PX;
                  const h = Math.max((block.endMinutes - block.startMinutes) * WEEK_PX, 14);
                  return (
                    <div
                      key={block.id}
                      className="absolute left-0.5 right-0.5 rounded overflow-hidden hover:brightness-95 cursor-pointer"
                      style={{ top: `${y}px`, height: `${h}px`, backgroundColor: block.color + "25", borderLeft: `2px solid ${block.color}` }}
                      onClick={(e) => { e.stopPropagation(); onBlockEdit(block); }}
                      title={block.title}
                    >
                      <p className="font-medium truncate px-1 leading-tight mt-0.5" style={{ color: block.color, fontSize: "10px" }}>{block.title}</p>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── MonthView ────────────────────────────────────────────────────────────────

function MonthView({ blocksMap, dateStr, todayStr, onDayCreate, onBlockEdit, onDayNav }: {
  blocksMap: Record<string, Block[]>;
  dateStr: string;
  todayStr: string;
  onDayCreate: (d: string) => void;
  onBlockEdit: (b: Block) => void;
  onDayNav: (d: string) => void;
}) {
  const [y, m] = dateStr.split("-").map(Number);
  const firstDow = new Date(y, m - 1, 1).getDay();
  const offset = firstDow === 0 ? 6 : firstDow - 1;
  const daysInMonth = new Date(y, m, 0).getDate();

  const cells: (string | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${String(y)}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="grid grid-cols-7 border-b border-slate-100">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-slate-400">{d}</div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b border-slate-50">
          {week.map((d, di) => {
            if (!d) return <div key={di} className="min-h-[90px] bg-slate-50/40 border-l border-slate-100" />;
            const dayBlocks = blocksMap[d] ?? [];
            const isToday = d === todayStr;
            return (
              <div
                key={d}
                className={cn("min-h-[90px] p-1.5 border-l border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors group", isToday && "bg-blue-50/60")}
                onClick={() => onDayCreate(d)}
              >
                <div className="flex items-center justify-between mb-1">
                  <button
                    className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold hover:ring-2 hover:ring-[#1e3a5f]/30 transition-all", isToday ? "bg-[#1e3a5f] text-white" : "text-slate-600 hover:bg-slate-200")}
                    onClick={(e) => { e.stopPropagation(); onDayNav(d); }}
                    title="Ver día"
                  >
                    {new Date(d + "T12:00:00").getDate()}
                  </button>
                  {dayBlocks.length > 0 && (
                    <span className="text-xs text-slate-400 opacity-0 group-hover:opacity-100" style={{ fontSize: "10px" }}>
                      <Plus className="w-3 h-3" />
                    </span>
                  )}
                </div>
                {dayBlocks.slice(0, 3).map((b) => (
                  <div
                    key={b.id}
                    className="text-xs truncate rounded px-1 py-0.5 mb-0.5 leading-tight cursor-pointer hover:brightness-95"
                    style={{ backgroundColor: b.color + "25", color: b.color, fontSize: "10px" }}
                    onClick={(e) => { e.stopPropagation(); onBlockEdit(b); }}
                    title={b.title}
                  >
                    {b.title}
                  </div>
                ))}
                {dayBlocks.length > 3 && (
                  <p className="text-slate-400" style={{ fontSize: "10px" }}>+{dayBlocks.length - 3} más</p>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── YearView ─────────────────────────────────────────────────────────────────

const INTENSITY_COLORS = [
  "bg-slate-100",
  "bg-[#1e3a5f]/20",
  "bg-[#1e3a5f]/40",
  "bg-[#1e3a5f]/65",
  "bg-[#1e3a5f]/90",
];

function blockIntensity(count: number): number {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 5) return 3;
  return 4;
}

function YearView({ blocksMap, dateStr, todayStr, onDayClick }: {
  blocksMap: Record<string, Block[]>;
  dateStr: string;
  todayStr: string;
  onDayClick: (d: string) => void;
}) {
  const year = parseInt(dateStr.slice(0, 4));
  const jan1Str = `${year}-01-01`;
  const jan1Dow = new Date(jan1Str + "T12:00:00").getDay();
  const offsetBack = jan1Dow === 0 ? 6 : jan1Dow - 1;
  let cur = addDays(jan1Str, -offsetBack);

  const weeks: (string | null)[][] = [];
  const monthLabels: { label: string; col: number }[] = [];
  let lastMonth = -1;

  for (let w = 0; w < 53; w++) {
    const week: (string | null)[] = [];
    for (let day = 0; day < 7; day++) {
      const d = new Date(cur + "T12:00:00");
      if (d.getFullYear() === year) {
        week.push(cur);
        const mon = d.getMonth();
        if (mon !== lastMonth && day === 0) {
          monthLabels.push({ label: new Intl.DateTimeFormat("es-ES", { month: "short" }).format(d), col: w });
          lastMonth = mon;
        }
      } else {
        week.push(null);
      }
      cur = addDays(cur, 1);
    }
    if (week.some((x) => x !== null)) weeks.push(week);
  }

  const DOW_LABELS = ["Lun", "", "Mié", "", "Vie", "", "Dom"];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="flex mb-2 ml-8" style={{ gap: "2px" }}>
        {weeks.map((_, wi) => {
          const label = monthLabels.find((m) => m.col === wi);
          return (
            <div key={wi} className="text-xs text-slate-400" style={{ width: 14, textAlign: "center" }}>
              {label?.label ?? ""}
            </div>
          );
        })}
      </div>

      {Array.from({ length: 7 }).map((_, day) => (
        <div key={day} className="flex items-center mb-0.5" style={{ gap: "2px" }}>
          <div className="text-xs text-slate-400 w-8 text-right pr-1 select-none" style={{ fontSize: "10px" }}>{DOW_LABELS[day]}</div>
          {weeks.map((week, wi) => {
            const ds = week[day];
            if (!ds) return <div key={wi} style={{ width: 14, height: 14 }} />;
            const count = (blocksMap[ds] ?? []).length;
            const level = blockIntensity(count);
            const isToday = ds === todayStr;
            return (
              <div
                key={wi}
                className={cn("rounded-sm cursor-pointer transition-transform hover:scale-125", INTENSITY_COLORS[level], isToday && "ring-2 ring-[#1e3a5f] ring-offset-1")}
                style={{ width: 14, height: 14 }}
                onClick={() => onDayClick(ds)}
                title={`${ds}: ${count} bloque${count !== 1 ? "s" : ""}`}
              />
            );
          })}
        </div>
      ))}

      <div className="flex items-center gap-1.5 mt-4 text-xs text-slate-400">
        <span>Menos</span>
        {INTENSITY_COLORS.map((c, i) => <div key={i} className={cn("w-3.5 h-3.5 rounded-sm", c)} />)}
        <span>Más</span>
      </div>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type BlockFormData = {
  date: string;
  title: string;
  startMinutes: number;
  endMinutes: number;
  color: string;
  notes: string | null;
  taskId: string | null;
};

// ─── Block Modal (shared Create + Edit) ──────────────────────────────────────

function BlockModal({
  mode,
  tasks,
  defaultDate,
  showDatePicker,
  block,
  onClose,
  onSave,
  onDelete,
}: {
  mode: "create" | "edit";
  tasks: TaskOption[];
  defaultDate: string;
  showDatePicker: boolean;
  block?: Block;
  onClose: () => void;
  onSave: (data: BlockFormData) => Promise<void>;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState(block?.title ?? "");
  const [date, setDate] = useState(block?.date ?? defaultDate);
  const [start, setStart] = useState(block ? minsToTime(block.startMinutes) : "09:00");
  const [end, setEnd] = useState(block ? minsToTime(block.endMinutes) : "10:00");
  const [color, setColor] = useState(block?.color ?? "#1e3a5f");
  const [notes, setNotes] = useState(block?.notes ?? "");
  const [taskId, setTaskId] = useState(block?.taskId ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({
        date,
        title: title.trim(),
        startMinutes: timeToMins(start),
        endMinutes: timeToMins(end),
        color,
        notes: notes || null,
        taskId: taskId || null,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-900">
            {mode === "create" ? "Nuevo bloque" : "Editar bloque"}
          </h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Nombre *</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Trabajar en proyecto X"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
            />
          </div>

          {showDatePicker && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Fecha</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Inicio</label>
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Fin</label>
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
          </div>

          {tasks.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Tarea asociada (opcional)</label>
              <select value={taskId} onChange={(e) => setTaskId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                <option value="">Sin tarea</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}{t.projectName ? ` (${t.projectName})` : ""}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-2">Color</label>
            <ColorPicker value={color} onChange={setColor} />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Notas (opcional)</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalles adicionales..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none" />
          </div>

          <div className="flex gap-3 pt-2">
            {onDelete && (
              <button type="button" onClick={onDelete}
                className="px-3 py-2 border border-red-200 text-red-500 rounded-xl text-sm hover:bg-red-50 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" disabled={!title.trim() || saving}
              className="flex-1 px-4 py-2 bg-[#1e3a5f] text-white rounded-xl text-sm font-medium hover:bg-[#162d4a] disabled:opacity-50">
              {saving ? "Guardando..." : mode === "create" ? "Crear bloque" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ScheduleClientProps {
  initialBlocks: Block[];
  blocksByDate: Record<string, Block[]>;
  dateStr: string;
  todayStr: string;
  tasks: TaskOption[];
  view: View;
}

const VIEW_LABELS: Record<View, string> = { day: "Día", week: "Semana", month: "Mes", year: "Año" };

export function ScheduleClient({ initialBlocks, blocksByDate, dateStr, todayStr, tasks, view }: ScheduleClientProps) {
  const router = useRouter();

  // Unified blocks state — synced from RSC props on navigation
  const [blocksMap, setBlocksMap] = useState<Record<string, Block[]>>(blocksByDate);

  useEffect(() => {
    setBlocksMap(blocksByDate);
  }, [dateStr, view]); // eslint-disable-line react-hooks/exhaustive-deps

  // Modal state
  const [createDate, setCreateDate] = useState<string | null>(null); // null = closed
  const [editBlock, setEditBlock] = useState<Block | null>(null);

  // Pusher: refresh when tasks change
  useEffect(() => {
    const pusher = getPusherClient();
    const ch = pusher.subscribe("tasks-global");
    const refresh = () => router.refresh();
    ch.bind("task:created", refresh);
    ch.bind("task:updated", refresh);
    ch.bind("task:deleted", refresh);
    return () => {
      ch.unbind("task:created", refresh);
      ch.unbind("task:updated", refresh);
      ch.unbind("task:deleted", refresh);
      pusher.unsubscribe("tasks-global");
    };
  }, [router]);

  // Navigation
  function goTo(newDateStr: string, newView?: View) {
    router.push(`/schedule?date=${newDateStr}&view=${newView ?? view}`);
  }

  // Mutations
  function updateMap(date: string, updater: (prev: Block[]) => Block[]) {
    setBlocksMap((prev) => ({ ...prev, [date]: updater(prev[date] ?? []) }));
  }

  async function handleCreate(data: BlockFormData) {
    const res = await fetch("/api/time-blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const block: Block = await res.json();
      updateMap(data.date, (prev) => [...prev, block].sort((a, b) => a.startMinutes - b.startMinutes));
      setCreateDate(null);
    }
  }

  async function handleEdit(data: BlockFormData) {
    if (!editBlock) return;
    const res = await fetch(`/api/time-blocks/${editBlock.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: data.title,
        startMinutes: data.startMinutes,
        endMinutes: data.endMinutes,
        color: data.color,
        notes: data.notes,
        taskId: data.taskId,
      }),
    });
    if (res.ok) {
      const updated: Block = await res.json();
      updateMap(editBlock.date, (prev) =>
        prev.map((b) => b.id === editBlock.id ? { ...b, ...updated } : b).sort((a, b) => a.startMinutes - b.startMinutes)
      );
      setEditBlock(null);
    }
  }

  async function handleToggleDone(block: Block) {
    updateMap(block.date, (prev) => prev.map((b) => b.id === block.id ? { ...b, done: !b.done } : b));
    await fetch(`/api/time-blocks/${block.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !block.done }),
    });
  }

  async function handleDelete(id: string, date: string) {
    updateMap(date, (prev) => prev.filter((b) => b.id !== id));
    setEditBlock(null);
    await fetch(`/api/time-blocks/${id}`, { method: "DELETE" });
  }

  // Header
  let headerTitle = "";
  if (view === "day") headerTitle = formatDayLong(dateStr);
  else if (view === "week") headerTitle = formatWeekRange(dateStr);
  else if (view === "month") headerTitle = formatMonth(dateStr);
  else headerTitle = formatYear(dateStr);

  const weekDates = view === "week" ? getWeekDates(dateStr) : [];
  const currentDayBlocks = blocksMap[dateStr] ?? [];

  return (
    <div className="max-w-6xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 capitalize">{headerTitle}</h1>
          {view === "day" && (
            <p className="text-xs text-slate-400 mt-0.5">
              {currentDayBlocks.length} bloques · {currentDayBlocks.filter(b => b.done).length} completados
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View switcher */}
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            {(["day", "week", "month", "year"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => router.push(`/schedule?date=${dateStr}&view=${v}`)}
                className={cn("px-2.5 py-1 rounded-md text-xs font-medium transition-colors", view === v ? "bg-white text-[#1e3a5f] shadow-sm" : "text-slate-500 hover:text-slate-700")}
              >
                {VIEW_LABELS[v]}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <button onClick={() => goTo(navDate(view, dateStr, -1))} className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => goTo(navDate(view, dateStr, 1))} className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50">
            <ChevronRight className="w-4 h-4" />
          </button>
          {view === "day" && dateStr !== todayStr && (
            <button onClick={() => goTo(todayStr)} className="px-3 py-1.5 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200">
              Hoy
            </button>
          )}

          {/* Add block button — visible in all views */}
          <button
            onClick={() => setCreateDate(dateStr)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#1e3a5f] text-white rounded-xl text-sm font-medium hover:bg-[#162d4a]"
          >
            <Plus className="w-4 h-4" /> Bloque
          </button>
        </div>
      </div>

      {/* Views */}
      {view === "day" && (
        <DayView
          blocks={currentDayBlocks}
          dateStr={dateStr}
          todayStr={todayStr}
          onToggleDone={handleToggleDone}
          onDelete={(id) => handleDelete(id, dateStr)}
          onEdit={setEditBlock}
          onOpenCreate={() => setCreateDate(dateStr)}
        />
      )}

      {view === "week" && (
        <WeekView
          blocksMap={blocksMap}
          weekDates={weekDates}
          todayStr={todayStr}
          onDayCreate={(d) => setCreateDate(d)}
          onBlockEdit={setEditBlock}
          onDayNav={(d) => goTo(d, "day")}
        />
      )}

      {view === "month" && (
        <MonthView
          blocksMap={blocksMap}
          dateStr={dateStr}
          todayStr={todayStr}
          onDayCreate={(d) => setCreateDate(d)}
          onBlockEdit={setEditBlock}
          onDayNav={(d) => goTo(d, "day")}
        />
      )}

      {view === "year" && (
        <YearView
          blocksMap={blocksMap}
          dateStr={dateStr}
          todayStr={todayStr}
          onDayClick={(d) => goTo(d, "day")}
        />
      )}

      {/* Create modal */}
      {createDate !== null && (
        <BlockModal
          mode="create"
          tasks={tasks}
          defaultDate={createDate}
          showDatePicker={view !== "day"}
          onClose={() => setCreateDate(null)}
          onSave={handleCreate}
        />
      )}

      {/* Edit modal */}
      {editBlock && (
        <BlockModal
          mode="edit"
          tasks={tasks}
          defaultDate={editBlock.date}
          showDatePicker={false}
          block={editBlock}
          onClose={() => setEditBlock(null)}
          onSave={handleEdit}
          onDelete={() => handleDelete(editBlock.id, editBlock.date)}
        />
      )}
    </div>
  );
}
