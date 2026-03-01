"use client";

import { useState, useEffect } from "react";
import { Play, Pause, Square, Clock, CheckCircle2, Flag, Folder, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AgentTaskItem = {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: string | null;
  projectName: string | null;
};

export type SessionState = {
  id: string;
  taskId: string;
  startedAt: string; // ISO string
  elapsedSeconds: number;
  status: "running" | "paused";
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(secs: number): string {
  if (secs <= 0) return "—";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

function formatLive(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

const priorityConfig = {
  low:    { label: "Baja",    color: "text-slate-400", dot: "bg-slate-300" },
  medium: { label: "Media",   color: "text-amber-500", dot: "bg-amber-400" },
  high:   { label: "Alta",    color: "text-orange-500", dot: "bg-orange-400" },
  urgent: { label: "Urgente", color: "text-red-500", dot: "bg-red-500" },
};

const statusLabels = {
  todo:        "Por hacer",
  in_progress: "En progreso",
  review:      "Revisión",
  done:        "Hecho",
};

// ── Task Row ──────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  session,
  doneSeconds,
  now,
  loading,
  onPlay,
  onPause,
  onStop,
}: {
  task: AgentTaskItem;
  session: SessionState | undefined;
  doneSeconds: number;
  now: number;
  loading: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
}) {
  const isRunning = session?.status === "running";
  const isPaused = session?.status === "paused";
  const priority = priorityConfig[task.priority];

  // Total seconds to display
  const liveRunSeconds = isRunning
    ? Math.floor((now - new Date(session!.startedAt).getTime()) / 1000)
    : 0;
  const sessionSeconds = session ? session.elapsedSeconds + liveRunSeconds : 0;
  const totalSeconds = doneSeconds + sessionSeconds;

  return (
    <div
      className={cn(
        "bg-white rounded-xl border transition-all",
        isRunning
          ? "border-emerald-300 shadow-sm shadow-emerald-100"
          : isPaused
          ? "border-amber-200"
          : "border-slate-200"
      )}
    >
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              {/* Priority dot */}
              <span className={cn("w-2 h-2 rounded-full flex-shrink-0", priority.dot)} />
              {isRunning && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
              )}
              <p className="text-sm font-semibold text-slate-900 leading-snug truncate">
                {task.title}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 ml-4">
              {task.projectName && (
                <span className="flex items-center gap-0.5">
                  <Folder className="w-3 h-3" />
                  {task.projectName}
                </span>
              )}
              <span>·</span>
              <span>{statusLabels[task.status]}</span>
              <span>·</span>
              <span className={priority.color}>{priority.label}</span>
            </div>
          </div>

          {/* Time display */}
          <div className="flex-shrink-0 text-right">
            {isRunning ? (
              <span className="font-mono text-base font-bold text-emerald-600">
                {formatLive(totalSeconds)}
              </span>
            ) : (
              <span className="text-sm font-medium text-slate-500">
                {formatDuration(totalSeconds)}
              </span>
            )}
            {isPaused && (
              <p className="text-[10px] text-amber-500 font-medium">pausado</p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-slate-100">
          {!isRunning && !isPaused && (
            <button
              onClick={onPlay}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1e3a5f] text-white rounded-lg text-xs font-medium hover:bg-[#162d4a] transition-colors disabled:opacity-50"
            >
              <Play className="w-3 h-3 fill-current" />
              Iniciar
            </button>
          )}

          {isPaused && (
            <>
              <button
                onClick={onPlay}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1e3a5f] text-white rounded-lg text-xs font-medium hover:bg-[#162d4a] transition-colors disabled:opacity-50"
              >
                <Play className="w-3 h-3 fill-current" />
                Reanudar
              </button>
              <button
                onClick={onStop}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="w-3 h-3" />
                Terminar
              </button>
            </>
          )}

          {isRunning && (
            <>
              <button
                onClick={onPause}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-amber-300 text-amber-700 bg-amber-50 rounded-lg text-xs font-medium hover:bg-amber-100 transition-colors disabled:opacity-50"
              >
                <Pause className="w-3 h-3 fill-current" />
                Pausar
              </button>
              <button
                onClick={onStop}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="w-3 h-3" />
                Terminar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface AgentTasksProps {
  agentId: string;
  agentName: string;
  initialTasks: AgentTaskItem[];
  initialSessions: SessionState[];           // active (running/paused) sessions
  doneTimes: Record<string, number>;          // taskId → accumulated done seconds
  initialTodaySeconds: number;
}

export function AgentTasks({
  agentId,
  agentName,
  initialTasks,
  initialSessions,
  doneTimes,
  initialTodaySeconds,
}: AgentTasksProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [sessions, setSessions] = useState<Record<string, SessionState>>(
    () => Object.fromEntries(initialSessions.map((s) => [s.taskId, s]))
  );
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState<string | null>(null);
  const [todayBase, setTodayBase] = useState(initialTodaySeconds);

  // The one running session (at most one)
  const runningSession = Object.values(sessions).find((s) => s.status === "running");

  // Live tick — only when a session is running
  useEffect(() => {
    if (!runningSession) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [runningSession?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Today's live total = base (done sessions) + active session time
  const todayLive = (() => {
    let extra = 0;
    for (const s of Object.values(sessions)) {
      extra += s.elapsedSeconds;
      if (s.status === "running") {
        extra += Math.floor((now - new Date(s.startedAt).getTime()) / 1000);
      }
    }
    return todayBase + extra;
  })();

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handlePlay(taskId: string) {
    setLoading(taskId);
    try {
      const res = await fetch("/api/agent-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, taskId }),
      });
      if (!res.ok) return;
      const { session, previousSession } = await res.json();

      setSessions((prev) => {
        const next = { ...prev };
        if (previousSession) next[previousSession.taskId] = previousSession;
        next[taskId] = session;
        return next;
      });
      setNow(Date.now());
    } finally {
      setLoading(null);
    }
  }

  async function handlePause(sessionId: string, taskId: string) {
    setLoading(taskId);
    try {
      const res = await fetch(`/api/agent-sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pause" }),
      });
      if (!res.ok) return;
      const updated = await res.json();
      setSessions((prev) => ({ ...prev, [taskId]: updated }));
    } finally {
      setLoading(null);
    }
  }

  async function handleStop(sessionId: string, taskId: string) {
    if (!confirm(`¿Marcar como terminada esta tarea? Esto detendrá el cronómetro y la moverá a "Hecho".`)) return;
    setLoading(taskId);
    try {
      const res = await fetch(`/api/agent-sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
      if (!res.ok) return;
      const done = await res.json();

      // Add elapsed to today's base, remove session and task from view
      setTodayBase((prev) => prev + done.elapsedSeconds);
      setSessions((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } finally {
      setLoading(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Metrics bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 text-slate-400 text-xs mb-1">
            <Timer className="w-3.5 h-3.5" />
            Hoy
          </div>
          <p className="text-lg font-bold text-slate-900 font-mono">
            {todayLive > 0 ? formatDuration(todayLive) : "—"}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 text-slate-400 text-xs mb-1">
            <Square className="w-3.5 h-3.5" />
            Tareas activas
          </div>
          <p className="text-lg font-bold text-slate-900">{tasks.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 text-slate-400 text-xs mb-1">
            <Clock className="w-3.5 h-3.5" />
            En curso
          </div>
          <p className="text-lg font-bold text-slate-900">
            {runningSession ? (
              <span className="text-emerald-600">
                {formatLive(
                  (sessions[runningSession.taskId]?.elapsedSeconds ?? 0) +
                  Math.floor((now - new Date(runningSession.startedAt).getTime()) / 1000)
                )}
              </span>
            ) : (
              <span className="text-slate-300">—</span>
            )}
          </p>
        </div>
      </div>

      {/* Task list */}
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-xl border border-slate-200">
          <CheckCircle2 className="w-10 h-10 text-emerald-300 mb-3" />
          <p className="font-semibold text-slate-700">Sin tareas pendientes</p>
          <p className="text-sm text-slate-400 mt-1">
            Asigna tareas a {agentName} desde el kanban para que aparezcan aquí.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
            Tareas asignadas
          </h2>
          {tasks.map((task) => {
            const session = sessions[task.id];
            const isLoading = loading === task.id;
            const sessionId = session?.id;

            return (
              <TaskRow
                key={task.id}
                task={task}
                session={session}
                doneSeconds={doneTimes[task.id] ?? 0}
                now={now}
                loading={isLoading}
                onPlay={() => handlePlay(task.id)}
                onPause={() => sessionId && handlePause(sessionId, task.id)}
                onStop={() => sessionId && handleStop(sessionId, task.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
