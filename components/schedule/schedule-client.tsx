"use client";

import { useState, useRef } from "react";
import { Plus, Trash2, Check, ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

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
};

export type TaskOption = { id: string; title: string; projectName: string | null };

const BLOCK_COLORS = [
  "#1e3a5f", "#0284c7", "#059669", "#d97706",
  "#dc2626", "#7c3aed", "#db2777", "#475569",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function minsToTime(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function timeToMins(time: string) {
  const [hStr, mStr] = time.split(":");
  return parseInt(hStr) * 60 + parseInt(mStr);
}

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function formatDateShort(dateStr: string) {
  return new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(new Date(dateStr + "T12:00:00"));
}

const START_HOUR = 6;   // 6 AM
const END_HOUR = 23;    // 11 PM
const TOTAL_MINS = (END_HOUR - START_HOUR) * 60;
const PX_PER_MIN = 1.8; // pixels per minute → timeline height

// ─── Component ───────────────────────────────────────────────────────────────

interface ScheduleClientProps {
  initialBlocks: Block[];
  dateStr: string;
  todayStr: string;
  tasks: TaskOption[];
}

export function ScheduleClient({ initialBlocks, dateStr, todayStr, tasks }: ScheduleClientProps) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  // Create form
  const [newTitle, setNewTitle] = useState("");
  const [newStart, setNewStart] = useState("09:00");
  const [newEnd, setNewEnd] = useState("10:00");
  const [newColor, setNewColor] = useState("#1e3a5f");
  const [newNotes, setNewNotes] = useState("");
  const [newTaskId, setNewTaskId] = useState("");

  const isToday = dateStr === todayStr;
  const prevDate = addDays(dateStr, -1);
  const nextDate = addDays(dateStr, 1);

  const totalPx = TOTAL_MINS * PX_PER_MIN;

  function minsToY(mins: number) {
    return Math.max(0, (mins - START_HOUR * 60) * PX_PER_MIN);
  }

  // ── Create ──
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/time-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: dateStr,
          title: newTitle.trim(),
          startMinutes: timeToMins(newStart),
          endMinutes: timeToMins(newEnd),
          color: newColor,
          notes: newNotes || null,
          taskId: newTaskId || null,
        }),
      });
      if (res.ok) {
        const block = await res.json();
        setBlocks((prev) => [...prev, block].sort((a, b) => a.startMinutes - b.startMinutes));
        setNewTitle(""); setNewNotes(""); setNewTaskId(""); setShowCreate(false);
      }
    } finally {
      setCreating(false);
    }
  }

  // ── Toggle done ──
  async function handleToggleDone(block: Block) {
    setBlocks((prev) => prev.map((b) => b.id === block.id ? { ...b, done: !b.done } : b));
    await fetch(`/api/time-blocks/${block.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !block.done }),
    });
  }

  // ── Delete ──
  async function handleDelete(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    await fetch(`/api/time-blocks/${id}`, { method: "DELETE" });
  }

  // Current time indicator
  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();
  const showNowLine = isToday && currentMins >= START_HOUR * 60 && currentMins <= END_HOUR * 60;

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 capitalize">{formatDateShort(dateStr)}</h1>
          <p className="text-xs text-slate-400 mt-0.5">{blocks.length} bloques · {blocks.filter(b => b.done).length} completados</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push(`/schedule?date=${prevDate}`)} className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => router.push(`/schedule?date=${nextDate}`)} className="p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50">
            <ChevronRight className="w-4 h-4" />
          </button>
          {!isToday && (
            <button onClick={() => router.push("/schedule")} className="px-3 py-1.5 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200">
              Hoy
            </button>
          )}
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#1e3a5f] text-white rounded-xl text-sm font-medium hover:bg-[#162d4a]"
          >
            <Plus className="w-4 h-4" /> Bloque
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Timeline ── */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="relative" style={{ height: `${totalPx}px` }}>

              {/* Hour lines */}
              {Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, i) => {
                const hour = START_HOUR + i;
                const y = i * 60 * PX_PER_MIN;
                return (
                  <div key={hour} className="absolute left-0 right-0 flex items-center" style={{ top: `${y}px` }}>
                    <span className="w-14 text-xs text-slate-400 text-right pr-3 flex-shrink-0">
                      {hour === 12 ? "12 PM" : hour < 12 ? `${hour} AM` : `${hour - 12} PM`}
                    </span>
                    <div className="flex-1 border-t border-slate-100" />
                  </div>
                );
              })}

              {/* Now indicator */}
              {showNowLine && (
                <div
                  className="absolute left-14 right-0 flex items-center z-20 pointer-events-none"
                  style={{ top: `${minsToY(currentMins)}px` }}
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.5 flex-shrink-0" />
                  <div className="flex-1 border-t-2 border-red-400" />
                </div>
              )}

              {/* Blocks */}
              {blocks.map((block) => {
                const y = minsToY(block.startMinutes);
                const h = Math.max((block.endMinutes - block.startMinutes) * PX_PER_MIN, 24);
                const isShort = h < 40;
                return (
                  <div
                    key={block.id}
                    className={cn(
                      "absolute left-16 right-3 rounded-lg px-2.5 py-1.5 group cursor-default transition-opacity",
                      block.done && "opacity-60"
                    )}
                    style={{ top: `${y + 1}px`, height: `${h - 2}px`, backgroundColor: block.color + "20", borderLeft: `3px solid ${block.color}` }}
                  >
                    <div className={cn("flex items-start", isShort ? "gap-1" : "gap-2")}>
                      <button
                        onClick={() => handleToggleDone(block)}
                        className="flex-shrink-0 mt-0.5"
                        title="Marcar como hecho"
                      >
                        <div className={cn(
                          "w-3.5 h-3.5 rounded border-2 flex items-center justify-center",
                          block.done ? "border-current bg-current" : "border-current/50"
                        )} style={{ color: block.color }}>
                          {block.done && <Check className="w-2 h-2 text-white" />}
                        </div>
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-xs font-semibold leading-tight", block.done && "line-through")} style={{ color: block.color }}>
                          {block.title}
                        </p>
                        {!isShort && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            {minsToTime(block.startMinutes)} – {minsToTime(block.endMinutes)}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(block.id)}
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

        {/* ── List view ── */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Lista de bloques</h3>
          {blocks.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-6 text-center">
              <p className="text-sm text-slate-400">Sin bloques</p>
              <button onClick={() => setShowCreate(true)} className="mt-2 text-xs text-[#1e3a5f] hover:underline">
                + Agregar bloque
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {blocks.map((block) => (
                <div
                  key={block.id}
                  className={cn(
                    "bg-white rounded-xl border p-3 flex items-center gap-3 group",
                    block.done ? "border-slate-100 opacity-60" : "border-slate-200"
                  )}
                >
                  <button onClick={() => handleToggleDone(block)}>
                    <div className={cn(
                      "w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0",
                      block.done ? "border-current bg-current" : "border-current/40"
                    )} style={{ color: block.color }}>
                      {block.done && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium text-slate-800", block.done && "line-through")}>{block.title}</p>
                    <p className="text-xs text-slate-400">{minsToTime(block.startMinutes)} – {minsToTime(block.endMinutes)}</p>
                  </div>
                  <button onClick={() => handleDelete(block.id)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-5">Nuevo bloque de tiempo</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Nombre *</label>
                <input
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ej: Trabajar en proyecto X"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Inicio</label>
                  <input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Fin</label>
                  <input type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
              </div>

              {tasks.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Tarea asociada (opcional)</label>
                  <select value={newTaskId} onChange={(e) => setNewTaskId(e.target.value)}
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
                <div className="flex gap-2">
                  {BLOCK_COLORS.map((c) => (
                    <button key={c} type="button" onClick={() => setNewColor(c)}
                      className={cn("w-7 h-7 rounded-full border-2 transition-all", newColor === c ? "border-slate-600 scale-110" : "border-transparent")}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Notas (opcional)</label>
                <input value={newNotes} onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Detalles adicionales..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">
                  Cancelar
                </button>
                <button type="submit" disabled={!newTitle.trim() || creating}
                  className="flex-1 px-4 py-2 bg-[#1e3a5f] text-white rounded-xl text-sm font-medium hover:bg-[#162d4a] disabled:opacity-50">
                  {creating ? "Creando..." : "Crear bloque"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
