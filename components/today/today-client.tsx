"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sun, Flag, Folder, CheckCircle2, X, Pin, AlertCircle, Target, ChevronRight, Clock, Play, Timer, Repeat2, BookOpen, CalendarDays, RefreshCw } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { startTimer } from "@/components/timer/active-timer";

// ─── Types ───────────────────────────────────────────────────────────────────

export type FocusTask = {
  focusId: string;
  taskId: string;
  title: string;
  status: "todo" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: string | null;
  projectName: string | null;
  sortOrder: number;
};

export type PendingTask = {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: string | null;
  projectName: string | null;
};

export type ActiveObjective = {
  id: string;
  title: string;
  priority: string | null;
  overallProgress: number;
};

// ─── Config ──────────────────────────────────────────────────────────────────

const priorityConfig = {
  low:    { label: "Baja",    color: "text-slate-400" },
  medium: { label: "Media",   color: "text-amber-500" },
  high:   { label: "Alta",    color: "text-orange-500" },
  urgent: { label: "Urgente", color: "text-red-500" },
};

const statusConfig = {
  todo:        { label: "Por hacer",   className: "bg-slate-100 text-slate-600" },
  in_progress: { label: "En progreso", className: "bg-blue-50 text-blue-700" },
  review:      { label: "Revisión",    className: "bg-purple-50 text-purple-700" },
  done:        { label: "Hecho",       className: "bg-emerald-50 text-emerald-700" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

function getWeekProgress() {
  const now = new Date();
  const dow = now.getDay(); // 0=Sun … 6=Sat
  const dayOfWeek = dow === 0 ? 7 : dow; // Mon=1 … Sun=7
  const minutesIntoDay = now.getHours() * 60 + now.getMinutes();
  const totalMinutes = 7 * 24 * 60;
  const elapsed = (dayOfWeek - 1) * 24 * 60 + minutesIntoDay;
  return Math.min(100, Math.round((elapsed / totalMinutes) * 100));
}

function daysOverdue(dueDate: string, todayStr: string): number {
  const due = new Date(dueDate + "T00:00:00");
  const today = new Date(todayStr + "T00:00:00");
  const diff = today.getTime() - due.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// ─── Props ───────────────────────────────────────────────────────────────────

export type TimeStats = {
  todaySeconds: number;
  weekSeconds: number;
  todaySessions: number;
  weekSessions: number;
};

export type TodayHabit = {
  id: string;
  title: string;
  icon: string;
  color: string;
  doneToday: boolean;
};

interface TodayClientProps {
  userName: string;
  todayStr: string;
  formattedDate: string;
  focusTasks: FocusTask[];
  dueTodayTasks: PendingTask[];
  overdueTasks: PendingTask[];
  activeObjectives: ActiveObjective[];
  timeStats: TimeStats;
  todayHabits: TodayHabit[];
}

// ─── Component ───────────────────────────────────────────────────────────────

function formatSeconds(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function TodayClient({
  userName,
  todayStr,
  formattedDate,
  focusTasks: initialFocus,
  dueTodayTasks,
  overdueTasks,
  activeObjectives,
  timeStats,
  todayHabits: initialHabits,
}: TodayClientProps) {
  const router = useRouter();
  const weekPct = getWeekProgress();
  const [loadingTaskId, setLoadingTaskId] = useState<string | null>(null);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [focusTasks, setFocusTasks] = useState<FocusTask[]>(initialFocus);
  const [pinLimitHit, setPinLimitHit] = useState(false);
  const [habits, setHabits] = useState<TodayHabit[]>(initialHabits);

  const focusTaskIds = new Set(focusTasks.map((f) => f.taskId));
  const canPin = focusTasks.length < 3;

  // ── Actions ──

  async function handleUnpin(focusId: string) {
    setLoadingTaskId(focusId);
    setFocusTasks((prev) => prev.filter((f) => f.focusId !== focusId));
    try {
      await fetch(`/api/daily-focus/${focusId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setLoadingTaskId(null);
    }
  }

  async function handlePin(task: PendingTask) {
    if (!canPin) { setPinLimitHit(true); setTimeout(() => setPinLimitHit(false), 3000); return; }
    setLoadingTaskId(task.id);
    try {
      const res = await fetch("/api/daily-focus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, date: todayStr }),
      });
      if (res.ok) {
        const row = await res.json();
        setFocusTasks((prev) => [
          ...prev,
          {
            focusId: row.id ?? row.focusId ?? task.id + "_tmp",
            taskId: task.id,
            title: task.title,
            status: task.status,
            priority: task.priority,
            dueDate: task.dueDate,
            projectName: task.projectName,
            sortOrder: prev.length,
          },
        ]);
        router.refresh();
      } else {
        setPinLimitHit(true);
        setTimeout(() => setPinLimitHit(false), 3000);
      }
    } finally {
      setLoadingTaskId(null);
    }
  }

  async function handleHabitToggle(habit: TodayHabit) {
    const wasDone = habit.doneToday;
    setHabits((prev) => prev.map((h) => h.id === habit.id ? { ...h, doneToday: !wasDone } : h));
    if (wasDone) {
      await fetch(`/api/habits/${habit.id}/log?date=${todayStr}`, { method: "DELETE" });
    } else {
      await fetch(`/api/habits/${habit.id}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: todayStr }),
      });
    }
  }

  async function handleComplete(taskId: string, focusId?: string) {
    setCompletingTaskId(taskId);
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      if (focusId) setFocusTasks((prev) => prev.filter((f) => f.focusId !== focusId));
      router.refresh();
    } finally {
      setCompletingTaskId(null);
    }
  }

  // ── Render ──

  const pendingNotFocused = dueTodayTasks.filter((t) => !focusTaskIds.has(t.id));
  const overdueNotFocused = overdueTasks.filter((t) => !focusTaskIds.has(t.id));

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sun className="w-5 h-5 text-amber-500" />
              <h1 className="text-xl font-bold text-slate-900">
                {getGreeting()}, {userName.split(" ")[0]}
              </h1>
            </div>
            <p className="text-sm text-slate-500 capitalize">{formattedDate}</p>
            <div className="flex flex-wrap gap-3 mt-2">
              <a href={`/journal?date=${todayStr}`} className="inline-flex items-center gap-1.5 text-xs text-[#1e3a5f] hover:underline font-medium">
                <BookOpen className="w-3.5 h-3.5" /> Diario de hoy
              </a>
              <a href="/schedule" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#1e3a5f] hover:underline font-medium">
                <CalendarDays className="w-3.5 h-3.5" /> Agenda
              </a>
              <a href="/review" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#1e3a5f] hover:underline font-medium">
                <RefreshCw className="w-3.5 h-3.5" /> Revisión semanal
              </a>
            </div>
          </div>
          <div className="text-right min-w-[140px]">
            <p className="text-xs text-slate-400 mb-1">Progreso de la semana</p>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1e3a5f] rounded-full transition-all"
                style={{ width: `${weekPct}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">{weekPct}%</p>
          </div>
        </div>

        {pinLimitHit && (
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            Ya tienes 3 tareas fijadas para hoy. Desancla una para agregar otra.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left: Tasks ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Hábitos del día */}
          {habits.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Repeat2 className="w-4 h-4 text-[#1e3a5f]" />
                  <h2 className="font-semibold text-slate-800 text-sm">Hábitos de hoy</h2>
                  <span className="text-xs text-slate-400">{habits.filter((h) => h.doneToday).length}/{habits.length}</span>
                </div>
                <a href="/habits" className="flex items-center gap-1 text-xs text-slate-400 hover:text-[#1e3a5f] transition-colors">
                  Ver todos <ChevronRight className="w-3 h-3" />
                </a>
              </div>
              <div className="flex flex-wrap gap-2">
                {habits.map((habit) => (
                  <button
                    key={habit.id}
                    onClick={() => handleHabitToggle(habit)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all",
                      habit.doneToday
                        ? "border-transparent text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    )}
                    style={habit.doneToday ? { backgroundColor: habit.color } : {}}
                  >
                    <span>{habit.icon}</span>
                    <span className={habit.doneToday ? "line-through opacity-80" : ""}>{habit.title}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Mis 3 del día */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Pin className="w-4 h-4 text-[#1e3a5f]" />
              <h2 className="font-semibold text-slate-800 text-sm">Mis 3 del día</h2>
              <span className="text-xs text-slate-400">{focusTasks.length}/3</span>
            </div>

            <div className="space-y-2">
              {focusTasks.map((task, idx) => (
                <div
                  key={task.focusId}
                  className="bg-white rounded-xl border border-[#1e3a5f]/20 p-4 flex items-start gap-3 shadow-sm"
                >
                  <span className="w-6 h-6 rounded-full bg-[#1e3a5f] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 text-sm leading-snug">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {task.projectName && (
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <Folder className="w-3 h-3" />{task.projectName}
                        </span>
                      )}
                      <span className={cn("flex items-center gap-1 text-xs font-medium", priorityConfig[task.priority].color)}>
                        <Flag className="w-3 h-3" />{priorityConfig[task.priority].label}
                      </span>
                      {task.dueDate && (
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <Clock className="w-3 h-3" />{formatDate(task.dueDate)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => startTimer({ taskId: task.taskId, description: task.title })}
                      title="Iniciar timer"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-[#1e3a5f] hover:bg-[#1e3a5f]/10 transition-colors"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleComplete(task.taskId, task.focusId)}
                      disabled={completingTaskId === task.taskId}
                      title="Marcar como hecha"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-40"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleUnpin(task.focusId)}
                      disabled={loadingTaskId === task.focusId}
                      title="Quitar del día"
                      className="p-1.5 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors disabled:opacity-40"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {focusTasks.length === 0 && (
                <div className="bg-slate-50 rounded-xl border border-dashed border-slate-200 p-6 text-center">
                  <Pin className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Fija hasta 3 tareas como tus prioridades del día</p>
                  <p className="text-xs text-slate-400 mt-1">Usa el botón 📌 en las secciones de abajo</p>
                </div>
              )}
            </div>
          </section>

          {/* Pendiente hoy */}
          {pendingNotFocused.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <h2 className="font-semibold text-slate-800 text-sm">Vence hoy</h2>
                <span className="text-xs text-slate-400">{pendingNotFocused.length}</span>
              </div>
              <div className="space-y-1.5">
                {pendingNotFocused.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    variant="today"
                    todayStr={todayStr}
                    canPin={canPin}
                    isLoading={loadingTaskId === task.id}
                    isCompleting={completingTaskId === task.id}
                    onPin={() => handlePin(task)}
                    onComplete={() => handleComplete(task.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Atrasadas */}
          {overdueNotFocused.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <h2 className="font-semibold text-slate-800 text-sm">Atrasadas</h2>
                <span className="text-xs bg-red-100 text-red-600 rounded-full px-1.5 py-0.5">{overdueNotFocused.length}</span>
              </div>
              <div className="space-y-1.5">
                {overdueNotFocused.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    variant="overdue"
                    todayStr={todayStr}
                    canPin={canPin}
                    isLoading={loadingTaskId === task.id}
                    isCompleting={completingTaskId === task.id}
                    onPin={() => handlePin(task)}
                    onComplete={() => handleComplete(task.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {pendingNotFocused.length === 0 && overdueNotFocused.length === 0 && focusTasks.length > 0 && (
            <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 text-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
              <p className="text-sm font-medium text-emerald-700">¡Sin tareas pendientes para hoy!</p>
              <p className="text-xs text-emerald-600 mt-0.5">Enfócate en tus 3 prioridades del día</p>
            </div>
          )}
        </div>

        {/* ── Right: Objetivos ── */}
        <div className="space-y-5">
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-[#1e3a5f]" />
                <h2 className="font-semibold text-slate-800 text-sm">Objetivos activos</h2>
              </div>
              <a href="/objectives" className="flex items-center gap-1 text-xs text-slate-400 hover:text-[#1e3a5f] transition-colors">
                Ver todos <ChevronRight className="w-3 h-3" />
              </a>
            </div>

            {activeObjectives.length === 0 ? (
              <div className="bg-slate-50 rounded-xl border border-dashed border-slate-200 p-5 text-center">
                <Target className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-400">No tienes objetivos activos</p>
                <a href="/objectives" className="text-xs text-[#1e3a5f] hover:underline mt-1 inline-block">Crear objetivo →</a>
              </div>
            ) : (
              <div className="space-y-3">
                {activeObjectives.map((obj) => (
                  <a
                    key={obj.id}
                    href={`/objectives/${obj.id}`}
                    className="block bg-white rounded-xl border border-slate-200 p-3.5 hover:border-[#1e3a5f]/30 hover:shadow-sm transition-all"
                  >
                    <p className="text-sm font-medium text-slate-800 leading-snug mb-2">{obj.title}</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            obj.overallProgress >= 100 ? "bg-emerald-500" :
                            obj.overallProgress >= 60  ? "bg-[#1e3a5f]" :
                            obj.overallProgress >= 30  ? "bg-amber-500" : "bg-slate-400"
                          )}
                          style={{ width: `${obj.overallProgress}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500 flex-shrink-0">{obj.overallProgress}%</span>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </section>

          {/* Mini stats */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Hoy</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-[#1e3a5f]">{focusTasks.length}</p>
                <p className="text-xs text-slate-500 mt-0.5">Fijadas</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-red-500">{overdueTasks.length}</p>
                <p className="text-xs text-slate-500 mt-0.5">Atrasadas</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-blue-600">{dueTodayTasks.length}</p>
                <p className="text-xs text-slate-500 mt-0.5">Vencen hoy</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-emerald-600">{activeObjectives.length}</p>
                <p className="text-xs text-slate-500 mt-0.5">Objetivos</p>
              </div>
            </div>
          </div>

          {/* Time tracking stats */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-[#1e3a5f]" />
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tiempo registrado</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Hoy</span>
                <span className="text-sm font-bold text-[#1e3a5f]">
                  {timeStats.todaySeconds > 0 ? formatSeconds(timeStats.todaySeconds) : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Esta semana</span>
                <span className="text-sm font-bold text-slate-700">
                  {timeStats.weekSeconds > 0 ? formatSeconds(timeStats.weekSeconds) : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                <span className="text-xs text-slate-400">Sesiones esta semana</span>
                <span className="text-xs text-slate-500">{timeStats.weekSessions}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── TaskRow ─────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  variant,
  todayStr,
  canPin,
  isLoading,
  isCompleting,
  onPin,
  onComplete,
}: {
  task: PendingTask;
  variant: "today" | "overdue";
  todayStr: string;
  canPin: boolean;
  isLoading: boolean;
  isCompleting: boolean;
  onPin: () => void;
  onComplete: () => void;
}) {
  const overdueDays = variant === "overdue" && task.dueDate ? daysOverdue(task.dueDate, todayStr) : 0;

  return (
    <div className={cn(
      "bg-white rounded-xl border p-3.5 flex items-center gap-3 group",
      variant === "overdue" ? "border-red-200" : "border-slate-200"
    )}>
      <button
        onClick={onComplete}
        disabled={isCompleting}
        title="Marcar como hecha"
        className="w-4 h-4 rounded border border-slate-300 flex-shrink-0 hover:border-emerald-500 hover:bg-emerald-50 transition-colors disabled:opacity-40 flex items-center justify-center"
      >
        {isCompleting && <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
      </button>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-800 font-medium leading-snug truncate">{task.title}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {task.projectName && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Folder className="w-3 h-3" />{task.projectName}
            </span>
          )}
          <span className={cn("text-xs font-medium", priorityConfig[task.priority].color)}>
            {priorityConfig[task.priority].label}
          </span>
          {variant === "overdue" && overdueDays > 0 && (
            <span className="text-xs text-red-500 font-medium">
              {overdueDays === 1 ? "1 día de retraso" : `${overdueDays} días de retraso`}
            </span>
          )}
        </div>
      </div>

      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 flex-shrink-0 transition-opacity">
        <button
          onClick={() => startTimer({ taskId: task.id, description: task.title })}
          title="Iniciar timer"
          className="p-1.5 rounded-lg text-slate-400 hover:text-[#1e3a5f] hover:bg-[#1e3a5f]/10 transition-colors"
        >
          <Play className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onPin}
          disabled={isLoading || !canPin}
          title={canPin ? "Fijar para hoy" : "Límite de 3 alcanzado"}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-[#1e3a5f]/30 text-[#1e3a5f] hover:bg-[#1e3a5f] hover:text-white transition-all disabled:opacity-40"
        >
          <Pin className="w-3 h-3" />
          Fijar
        </button>
      </div>
    </div>
  );
}
