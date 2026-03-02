"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Play, Pause, CheckCircle2, Clock, Square, Timer,
  Folder, X, ChevronRight, Bot, Coins, FileText, Settings,
  History, Activity, Zap, SlidersHorizontal, MessageSquare,
  Pencil, Save, User, BookOpen, Plus, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getPusherClient } from "@/lib/pusher";
import { AgentChat } from "./agent-chat";
import { AgentDirectChat } from "./agent-direct-chat";
import { QuickAddTask } from "@/components/tasks/quick-add-task";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AgentTaskItem = {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: string | null;
  projectName: string | null;
  projectId: string | null;
  agentStatus: string | null;
};

export type SessionState = {
  id: string;
  taskId: string;
  startedAt: string;
  elapsedSeconds: number;
  status: "running" | "paused";
};

export type HistoryItem = {
  taskId: string;
  taskTitle: string;
  taskStatus: string;
  taskPriority: string;
  projectName: string | null;
  projectId: string | null;
  totalSeconds: number;
  totalTokens: number;
  sessionCount: number;
  lastWorked: string | null;
};

export type AgentConfig = {
  aiModel: string | null;
  aiPrompt: string | null;
  personality: string | null;
  maxTokens: number | null;
  tokenBudget: number | null;
  temperature: number | null;
};

type KnowledgeItem = {
  id: string;
  agentId: string;
  title: string;
  content: string;
  type: string;
  createdAt: string;
};

type FullSession = {
  id: string;
  taskId: string;
  agentId: string;
  startedAt: string;
  pausedAt: string | null;
  endedAt: string | null;
  elapsedSeconds: number;
  status: string;
  notes: string | null;
  tokenCost: number | null;
  createdAt: string;
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

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

const priorityConfig = {
  low:    { label: "Baja",    color: "text-slate-400", dot: "bg-slate-300" },
  medium: { label: "Media",   color: "text-amber-500", dot: "bg-amber-400" },
  high:   { label: "Alta",    color: "text-orange-500", dot: "bg-orange-400" },
  urgent: { label: "Urgente", color: "text-red-500",   dot: "bg-red-500" },
};

const statusLabels: Record<string, string> = {
  todo: "Por hacer", in_progress: "En progreso", review: "Revisión", done: "Hecho",
};

const agentStatusConfig: Record<string, { label: string; color: string }> = {
  queued:    { label: "En cola",    color: "text-amber-600 bg-amber-50 border-amber-200" },
  analyzing: { label: "Analizando", color: "text-blue-600 bg-blue-50 border-blue-200" },
  working:   { label: "Trabajando", color: "text-orange-600 bg-orange-50 border-orange-200" },
  done:      { label: "Hecho",      color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  error:     { label: "Error",      color: "text-red-600 bg-red-50 border-red-200" },
};

function AgentStatusBadge({ status }: { status: string }) {
  const cfg = agentStatusConfig[status];
  if (!cfg) return null;
  return (
    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", cfg.color)}>
      {cfg.label}
    </span>
  );
}

const AI_MODELS = [
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
  { value: "claude-sonnet-4-6",         label: "Claude Sonnet 4.6" },
  { value: "claude-opus-4-6",           label: "Claude Opus 4.6" },
  { value: "gpt-4o",                    label: "GPT-4o" },
  { value: "gpt-4o-mini",               label: "GPT-4o Mini" },
  { value: "custom",                    label: "Personalizado…" },
];

// ── Task Detail Panel (slide-over) ────────────────────────────────────────────

function TaskDetailPanel({
  task,
  agentId,
  session,
  doneSeconds,
  now,
  loading,
  onPlay,
  onPause,
  onStop,
  onClose,
  onUpdate,
  onSendToAgent,
  readOnly,
}: {
  task: AgentTaskItem;
  agentId: string;
  session?: SessionState;
  doneSeconds: number;
  now: number;
  loading: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onClose: () => void;
  onUpdate: (taskId: string, updates: Partial<AgentTaskItem>) => void;
  onSendToAgent: (taskId: string) => void;
  readOnly: boolean;
}) {
  const isRunning = session?.status === "running";
  const isPaused = session?.status === "paused";
  const priority = priorityConfig[task.priority as keyof typeof priorityConfig] ?? priorityConfig.medium;

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(task.description ?? "");
  const [editPriority, setEditPriority] = useState(task.priority);
  const [editStatus, setEditStatus] = useState(task.status);
  const [saving, setSaving] = useState(false);

  async function handleSaveEdit() {
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim() || task.title,
          description: editDescription || null,
          priority: editPriority,
          status: editStatus,
        }),
      });
      if (res.ok) {
        onUpdate(task.id, {
          title: editTitle.trim() || task.title,
          description: editDescription || null,
          priority: editPriority,
          status: editStatus,
        });
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    setEditTitle(task.title);
    setEditDescription(task.description ?? "");
    setEditPriority(task.priority);
    setEditStatus(task.status);
    setEditing(false);
  }

  const liveRunSeconds = isRunning
    ? Math.floor((now - new Date(session!.startedAt).getTime()) / 1000)
    : 0;
  const sessionSeconds = session ? session.elapsedSeconds + liveRunSeconds : 0;
  const totalSeconds = doneSeconds + sessionSeconds;

  // Sessions history for this task
  const [sessions, setSessions] = useState<FullSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  useEffect(() => {
    setLoadingSessions(true);
    fetch(`/api/agent-sessions?agentId=${agentId}&taskId=${task.id}`)
      .then((r) => r.json())
      .then((data) => setSessions(Array.isArray(data) ? data : []))
      .catch(() => setSessions([]))
      .finally(() => setLoadingSessions(false));
  }, [agentId, task.id]);

  // Activity timeline for this task
  type ActivityEvent = {
    id: string;
    type: string;
    userName: string | null;
    oldValue: string | null;
    newValue: string | null;
    createdAt: string;
  };
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    fetch(`/api/tasks/${task.id}/activity`)
      .then((r) => r.json())
      .then((data) => setActivityEvents(Array.isArray(data) ? data : []))
      .catch(() => setActivityEvents([]));
  }, [task.id]);

  const agentEvents = activityEvents.filter(
    (e) => e.type === "agent_status_changed" || (e.type === "status_changed" && e.userName === "Agente IA")
  );

  async function saveSessionField(sessionId: string, field: "notes" | "tokenCost", value: string | null) {
    const body = field === "notes"
      ? { notes: value }
      : { tokenCost: value === "" || value === null ? null : parseInt(value, 10) };

    const res = await fetch(`/api/agent-sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated: FullSession = await res.json();
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? updated : s)));
    }
  }

  const doneSessions = sessions.filter((s) => s.status === "done");
  const activeSession = sessions.find((s) => s.status === "running" || s.status === "paused");

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-lg h-full bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
            <span className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", priority.dot)} />
            {editing ? (
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="flex-1 text-sm font-semibold text-slate-900 border-b border-[#1e3a5f] focus:outline-none bg-transparent"
                autoFocus
              />
            ) : (
              <h2 className="font-semibold text-slate-900 truncate">{task.title}</h2>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {!readOnly && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                title="Editar tarea"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            {editing && (
              <>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#1e3a5f] text-white rounded-lg text-xs font-medium hover:bg-[#162d4a] transition-colors disabled:opacity-50"
                >
                  <Save className="w-3 h-3" />
                  {saving ? "…" : "Guardar"}
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            {!editing && (
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Task meta */}
          <div className="px-5 py-4 border-b border-slate-100 space-y-2">
            {editing ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as AgentTaskItem["status"])}
                    className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#1e3a5f] bg-white text-slate-700"
                  >
                    <option value="todo">Por hacer</option>
                    <option value="in_progress">En progreso</option>
                    <option value="review">Revisión</option>
                    <option value="done">Hecho</option>
                  </select>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as AgentTaskItem["priority"])}
                    className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#1e3a5f] bg-white text-slate-700"
                  >
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Descripción (opcional)…"
                  rows={3}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] resize-none placeholder:text-slate-300 text-slate-700"
                />
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                  {task.projectName && (
                    <span className="flex items-center gap-1">
                      <Folder className="w-3 h-3" />
                      {task.projectId
                        ? <a href={`/projects/${task.projectId}`} className="hover:text-[#1e3a5f] hover:underline">{task.projectName}</a>
                        : task.projectName
                      }
                    </span>
                  )}
                  <span>{statusLabels[task.status] ?? task.status}</span>
                  <span className={priority.color}>{priority.label}</span>
                  {task.dueDate && <span>Vence: {formatDate(task.dueDate)}</span>}
                </div>
                {task.description && (
                  <p className="text-sm text-slate-600 leading-relaxed">{task.description}</p>
                )}
              </>
            )}
          </div>

          {/* Timer section (active tasks only) */}
          {!readOnly && (
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Cronómetro</p>
              <div className="flex items-center justify-between">
                <div>
                  {isRunning ? (
                    <span className="font-mono text-2xl font-bold text-emerald-600">{formatLive(totalSeconds)}</span>
                  ) : (
                    <span className="font-mono text-2xl font-bold text-slate-700">{formatDuration(totalSeconds)}</span>
                  )}
                  {isPaused && <p className="text-xs text-amber-500 font-medium mt-0.5">Pausado</p>}
                </div>
                <div className="flex items-center gap-2">
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
                      <button onClick={onPlay} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1e3a5f] text-white rounded-lg text-xs font-medium hover:bg-[#162d4a] transition-colors disabled:opacity-50">
                        <Play className="w-3 h-3 fill-current" />
                        Reanudar
                      </button>
                      <button onClick={onStop} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50">
                        <CheckCircle2 className="w-3 h-3" />
                        Terminar
                      </button>
                    </>
                  )}
                  {isRunning && (
                    <>
                      <button onClick={onPause} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-amber-300 text-amber-700 bg-amber-50 rounded-lg text-xs font-medium hover:bg-amber-100 transition-colors disabled:opacity-50">
                        <Pause className="w-3 h-3 fill-current" />
                        Pausar
                      </button>
                      <button onClick={onStop} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50">
                        <CheckCircle2 className="w-3 h-3" />
                        Terminar
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Active session notes/tokens */}
              {activeSession && (
                <div className="mt-4 space-y-3">
                  <SessionEditFields session={activeSession} onSave={saveSessionField} />
                </div>
              )}
            </div>
          )}

          {/* Agent chat */}
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-1.5 mb-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5 flex-1">
                <MessageSquare className="w-3 h-3" />
                Debate con el agente
              </p>
              {task.agentStatus ? (
                <AgentStatusBadge status={task.agentStatus} />
              ) : !readOnly && (
                <button
                  onClick={() => onSendToAgent(task.id)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-slate-200 text-slate-500 bg-white rounded-lg text-xs font-medium hover:border-[#1e3a5f] hover:text-[#1e3a5f] transition-colors"
                >
                  <Bot className="w-3 h-3" /> Enviar al agente
                </button>
              )}
            </div>
            <AgentChat taskId={task.id} agentStatus={task.agentStatus} />
          </div>

          {/* Agent activity timeline */}
          {agentEvents.length > 0 && (
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Activity className="w-3 h-3" />
                Actividad del agente
              </p>
              <div className="space-y-2">
                {agentEvents.map((evt) => (
                  <div key={evt.id} className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-[#1e3a5f]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot className="w-2.5 h-2.5 text-[#1e3a5f]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-700">
                        {evt.type === "agent_status_changed" ? (
                          <>Estado: <span className="font-medium">{evt.oldValue ?? "—"}</span> → <span className="font-medium">{evt.newValue}</span></>
                        ) : (
                          <>Tarea: <span className="font-medium">{evt.oldValue ?? "—"}</span> → <span className="font-medium">{evt.newValue}</span></>
                        )}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(evt.createdAt).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Session history */}
          <div className="px-5 py-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Historial de sesiones {doneSessions.length > 0 && `(${doneSessions.length})`}
            </p>
            {loadingSessions ? (
              <p className="text-sm text-slate-400">Cargando…</p>
            ) : doneSessions.length === 0 ? (
              <p className="text-sm text-slate-400">Sin sesiones completadas.</p>
            ) : (
              <div className="space-y-3">
                {doneSessions.map((s) => (
                  <DoneSessionRow key={s.id} session={s} onSave={saveSessionField} />
                ))}
                {doneSessions.length > 1 && (
                  <div className="flex items-center justify-between text-xs font-medium text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                    <span>Total ({doneSessions.length} sesiones)</span>
                    <span className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-slate-500">
                        <Timer className="w-3 h-3" />
                        {formatDuration(doneSessions.reduce((a, s) => a + s.elapsedSeconds, 0))}
                      </span>
                      <span className="flex items-center gap-1 text-slate-500">
                        <Coins className="w-3 h-3" />
                        {doneSessions.reduce((a, s) => a + (s.tokenCost ?? 0), 0).toLocaleString()}
                      </span>
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Session edit fields (notes + tokens) ──────────────────────────────────────

function SessionEditFields({
  session,
  onSave,
}: {
  session: FullSession;
  onSave: (id: string, field: "notes" | "tokenCost", value: string | null) => Promise<void>;
}) {
  const [notes, setNotes] = useState(session.notes ?? "");
  const [tokenCost, setTokenCost] = useState(session.tokenCost != null ? String(session.tokenCost) : "");
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const tokenRef = useRef(tokenCost);
  tokenRef.current = tokenCost;

  return (
    <>
      <div>
        <label className="text-xs text-slate-500 flex items-center gap-1 mb-1">
          <FileText className="w-3 h-3" /> Notas de sesión
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => onSave(session.id, "notes", notesRef.current || null)}
          rows={3}
          placeholder="Notas, observaciones, resultados…"
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] resize-none placeholder:text-slate-300"
        />
      </div>
      <div>
        <label className="text-xs text-slate-500 flex items-center gap-1 mb-1">
          <Coins className="w-3 h-3" /> Tokens utilizados
        </label>
        <input
          type="number"
          min={0}
          value={tokenCost}
          onChange={(e) => setTokenCost(e.target.value)}
          onBlur={() => onSave(session.id, "tokenCost", tokenRef.current || null)}
          placeholder="0"
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] placeholder:text-slate-300"
        />
      </div>
    </>
  );
}

// ── Done session row ──────────────────────────────────────────────────────────

function DoneSessionRow({
  session,
  onSave,
}: {
  session: FullSession;
  onSave: (id: string, field: "notes" | "tokenCost", value: string | null) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <span className="text-xs text-slate-600">{formatDate(session.endedAt ?? session.createdAt)}</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 font-mono">{formatDuration(session.elapsedSeconds)}</span>
          {session.tokenCost != null && (
            <span className="text-xs text-slate-400">{session.tokenCost.toLocaleString()} tokens</span>
          )}
          <ChevronRight className={cn("w-3.5 h-3.5 text-slate-400 transition-transform", expanded && "rotate-90")} />
        </div>
      </button>
      {expanded && (
        <div className="px-3 py-3 space-y-3 bg-white">
          <SessionEditFields session={session} onSave={onSave} />
        </div>
      )}
    </div>
  );
}

// ── Token Budget Bar ──────────────────────────────────────────────────────────

function TokenBudgetBar({ used, budget }: { used: number; budget: number | null }) {
  const pct = budget && budget > 0 ? Math.min((used / budget) * 100, 100) : null;
  const isOver = budget != null && used > budget;
  const color = isOver ? "bg-red-500" : pct != null && pct > 75 ? "bg-amber-400" : "bg-[#1e3a5f]";

  return (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
          <Coins className="w-3 h-3" /> Tokens este mes
        </span>
        <span className={cn("text-xs font-mono font-semibold", isOver ? "text-red-500" : "text-slate-700")}>
          {used.toLocaleString()}
          {budget != null && <span className="text-slate-400 font-normal"> / {budget.toLocaleString()}</span>}
        </span>
      </div>
      {budget != null ? (
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", color)}
            style={{ width: `${pct ?? 0}%` }}
          />
        </div>
      ) : (
        <p className="text-xs text-slate-400 italic">Sin presupuesto definido — configura uno en la tab Configurar</p>
      )}
      {isOver && (
        <p className="text-xs text-red-500 mt-1 font-medium">⚠ Presupuesto superado</p>
      )}
    </div>
  );
}

// ── Config Tab ────────────────────────────────────────────────────────────────

const KNOWLEDGE_TYPE_LABELS: Record<string, string> = {
  document: "Documento",
  instruction: "Instrucción",
  character: "Personaje",
};

const KNOWLEDGE_TYPE_COLORS: Record<string, string> = {
  document: "text-blue-600 bg-blue-50 border-blue-200",
  instruction: "text-violet-600 bg-violet-50 border-violet-200",
  character: "text-amber-600 bg-amber-50 border-amber-200",
};

function ConfigTab({ agentId, config }: { agentId: string; config: AgentConfig }) {
  // ── AI model ──
  const knownModels = AI_MODELS.slice(0, -1).map((m) => m.value);
  const isCustomInit = (config.aiModel ?? "") !== "" && !knownModels.includes(config.aiModel ?? "");
  const [aiModel, setAiModel] = useState(config.aiModel ?? "");
  const [customModel, setCustomModel] = useState(isCustomInit ? (config.aiModel ?? "") : "");
  const [showCustom, setShowCustom] = useState(isCustomInit);

  // ── Prompt + personality ──
  const [aiPrompt, setAiPrompt] = useState(config.aiPrompt ?? "");
  const [personality, setPersonality] = useState(config.personality ?? "");

  // ── Parameters ──
  const [maxTokens, setMaxTokens] = useState(config.maxTokens != null ? String(config.maxTokens) : "");
  const [tokenBudget, setTokenBudget] = useState(config.tokenBudget != null ? String(config.tokenBudget) : "");
  const [temperature, setTemperature] = useState(config.temperature ?? 0.7);

  // ── Save state ──
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // ── Knowledge (RAG) ──
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [kLoading, setKLoading] = useState(true);
  const [kAdding, setKAdding] = useState(false);
  const [kTitle, setKTitle] = useState("");
  const [kContent, setKContent] = useState("");
  const [kType, setKType] = useState<"document" | "instruction" | "character">("document");
  const [kSaving, setKSaving] = useState(false);

  // Fetch knowledge on mount
  useEffect(() => {
    fetch(`/api/agents/${agentId}/knowledge`)
      .then((r) => r.json())
      .then((data) => setKnowledge(Array.isArray(data) ? data : []))
      .catch(() => setKnowledge([]))
      .finally(() => setKLoading(false));
  }, [agentId]);

  function handleModelChange(val: string) {
    if (val === "custom") {
      setShowCustom(true);
      setAiModel(customModel);
    } else {
      setShowCustom(false);
      setAiModel(val);
    }
  }

  async function handleSave() {
    setSaving(true);
    const finalModel = showCustom ? customModel : aiModel;
    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiModel: finalModel || null,
          aiPrompt: aiPrompt || null,
          personality: personality || null,
          maxTokens: maxTokens ? parseInt(maxTokens, 10) : null,
          tokenBudget: tokenBudget ? parseInt(tokenBudget, 10) : null,
          temperature,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleKnowledgeAdd() {
    if (!kTitle.trim() || !kContent.trim()) return;
    setKSaving(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/knowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: kTitle.trim(), content: kContent.trim(), type: kType }),
      });
      if (res.ok) {
        const item = await res.json();
        setKnowledge((prev) => [...prev, item]);
        setKTitle("");
        setKContent("");
        setKType("document");
        setKAdding(false);
      }
    } finally {
      setKSaving(false);
    }
  }

  async function handleKnowledgeDelete(kid: string) {
    await fetch(`/api/agents/${agentId}/knowledge/${kid}`, { method: "DELETE" });
    setKnowledge((prev) => prev.filter((k) => k.id !== kid));
  }

  const selectValue = showCustom ? "custom" : (aiModel || "");

  return (
    <div className="space-y-6 py-2">

      {/* ── Modelo IA ── */}
      <section>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Bot className="w-4 h-4 text-[#1e3a5f]" />
          Modelo IA
        </h3>
        <select
          value={selectValue}
          onChange={(e) => handleModelChange(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] bg-white"
        >
          <option value="">— Sin modelo asignado —</option>
          {AI_MODELS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        {showCustom && (
          <input
            type="text"
            value={customModel}
            onChange={(e) => { setCustomModel(e.target.value); setAiModel(e.target.value); }}
            placeholder="ID del modelo, ej: mistral-7b"
            className="mt-2 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
          />
        )}
        {aiModel.startsWith("claude-") && (
          <p className="text-xs text-violet-500 mt-1">Requiere <code>ANTHROPIC_API_KEY</code> en .env.local</p>
        )}
      </section>

      {/* ── Instrucciones del sistema ── */}
      <section>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#1e3a5f]" />
          Instrucciones del sistema
        </h3>
        <textarea
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          rows={5}
          placeholder="Eres un agente especializado en… Tu objetivo es… Responde siempre en español."
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] resize-y min-h-[100px] placeholder:text-slate-300"
        />
        <p className="text-xs text-slate-400 mt-1">System message base enviado al modelo en cada respuesta.</p>
      </section>

      {/* ── Personalidad / Carácter ── */}
      <section>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <User className="w-4 h-4 text-[#1e3a5f]" />
          Personalidad y carácter
        </h3>
        <textarea
          value={personality}
          onChange={(e) => setPersonality(e.target.value)}
          rows={4}
          placeholder="Describe la personalidad, tono y características del agente. Ej: Directo, conciso, usa metáforas técnicas. No tolera ambigüedad. Siempre da ejemplos concretos."
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] resize-y min-h-[80px] placeholder:text-slate-300"
        />
        <p className="text-xs text-slate-400 mt-1">Se añade al system prompt. Define cómo se expresa el agente.</p>
      </section>

      {/* ── Base de conocimiento (RAG) ── */}
      <section>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#1e3a5f]" />
          Base de conocimiento
          <span className="text-[10px] font-normal text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">RAG</span>
        </h3>

        {kLoading ? (
          <p className="text-xs text-slate-400 py-2">Cargando…</p>
        ) : (
          <>
            {knowledge.length === 0 && !kAdding ? (
              <div className="bg-slate-50 rounded-xl p-4 text-center text-sm text-slate-400 border border-dashed border-slate-200">
                Sin conocimiento registrado aún.
              </div>
            ) : (
              <div className="space-y-2">
                {knowledge.map((item) => {
                  const typeColor = KNOWLEDGE_TYPE_COLORS[item.type] ?? "text-slate-500 bg-slate-50 border-slate-200";
                  const typeLabel = KNOWLEDGE_TYPE_LABELS[item.type] ?? item.type;
                  return (
                    <div
                      key={item.id}
                      className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border", typeColor)}>
                            {typeLabel}
                          </span>
                          <span className="text-sm font-medium text-slate-700 truncate">{item.title}</span>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{item.content}</p>
                      </div>
                      <button
                        onClick={() => handleKnowledgeDelete(item.id)}
                        className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5 p-0.5"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Inline add form */}
            {kAdding ? (
              <div className="mt-3 bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-200">
                <div className="flex gap-2">
                  <input
                    value={kTitle}
                    onChange={(e) => setKTitle(e.target.value)}
                    placeholder="Título del item…"
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                    autoFocus
                  />
                  <select
                    value={kType}
                    onChange={(e) => setKType(e.target.value as "document" | "instruction" | "character")}
                    className="border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 bg-white"
                  >
                    <option value="document">Documento</option>
                    <option value="instruction">Instrucción</option>
                    <option value="character">Personaje</option>
                  </select>
                </div>
                <textarea
                  value={kContent}
                  onChange={(e) => setKContent(e.target.value)}
                  rows={4}
                  placeholder="Contenido del conocimiento que el agente tendrá disponible…"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 resize-y min-h-[80px]"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => { setKAdding(false); setKTitle(""); setKContent(""); setKType("document"); }}
                    className="px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleKnowledgeAdd}
                    disabled={kSaving || !kTitle.trim() || !kContent.trim()}
                    className="px-3 py-1.5 text-sm bg-[#1e3a5f] text-white rounded-lg hover:bg-[#162d4a] disabled:opacity-50 transition-colors"
                  >
                    {kSaving ? "Guardando…" : "Añadir"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setKAdding(true)}
                className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-400 hover:border-[#1e3a5f]/40 hover:text-slate-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Añadir item al conocimiento
              </button>
            )}
            <p className="text-xs text-slate-400 mt-2">
              El agente accede a este conocimiento en cada respuesta IA (documentos, instrucciones, personajes).
            </p>
          </>
        )}
      </section>

      {/* ── Parámetros ── */}
      <section>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-[#1e3a5f]" />
          Parámetros
        </h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Máximo de tokens por respuesta</label>
            <input
              type="number"
              min={1}
              max={200000}
              value={maxTokens}
              onChange={(e) => setMaxTokens(e.target.value)}
              placeholder="Sin límite (500 por defecto)"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] placeholder:text-slate-300"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block flex items-center gap-1">
              <Coins className="w-3 h-3" /> Presupuesto mensual de tokens
            </label>
            <input
              type="number"
              min={1}
              value={tokenBudget}
              onChange={(e) => setTokenBudget(e.target.value)}
              placeholder="Sin presupuesto"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] placeholder:text-slate-300"
            />
            <p className="text-xs text-slate-400 mt-1">Ej: 100000 = 100k tokens/mes. La barra de consumo lo usará como referencia.</p>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 flex items-center justify-between">
              <span>Temperatura</span>
              <span className="font-mono text-slate-700">{temperature.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min={0}
              max={2}
              step={0.01}
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-[#1e3a5f]"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
              <span>0.0 — determinista</span>
              <span>2.0 — muy creativo</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Herramientas (placeholder) ── */}
      <section>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#1e3a5f]" />
          Herramientas
        </h3>
        <div className="bg-slate-50 rounded-xl p-4 text-center border border-dashed border-slate-200">
          <p className="text-sm text-slate-400">Próximamente — herramientas conectadas a APIs externas</p>
        </div>
      </section>

      {/* ── Save ── */}
      <div className="flex justify-end pt-2 border-t border-slate-100">
        <button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            "inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50",
            saved
              ? "bg-emerald-600 text-white"
              : "bg-[#1e3a5f] text-white hover:bg-[#162d4a]"
          )}
        >
          {saved ? (
            <><CheckCircle2 className="w-4 h-4" /> Guardado</>
          ) : saving ? (
            "Guardando…"
          ) : (
            "Guardar configuración"
          )}
        </button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface AgentPanelProps {
  agentId: string;
  agentName: string;
  agentAvatar?: string;
  agentColor?: string;
  agentConfig: AgentConfig;
  initialTasks: AgentTaskItem[];
  initialSessions: SessionState[];
  doneTimes: Record<string, number>;
  initialTodaySeconds: number;
  historyItems: HistoryItem[];
  monthlyTokens: number;
  projects?: { id: string; name: string }[];
  currentUserId?: string;
}

export function AgentPanel({
  agentId,
  agentName,
  agentAvatar = "🤖",
  agentColor = "#1e3a5f",
  agentConfig,
  initialTasks,
  initialSessions,
  doneTimes,
  initialTodaySeconds,
  historyItems: initialHistory,
  monthlyTokens,
  projects = [],
  currentUserId = "",
}: AgentPanelProps) {
  const router = useRouter();

  type Tab = "activas" | "historial" | "chat" | "configurar";
  const [tab, setTab] = useState<Tab>("activas");

  const [tasks, setTasks] = useState(initialTasks);
  const [sessions, setSessions] = useState<Record<string, SessionState>>(
    () => Object.fromEntries(initialSessions.map((s) => [s.taskId, s]))
  );
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState<string | null>(null);
  const [todayBase, setTodayBase] = useState(initialTodaySeconds);
  const [historyItems] = useState(initialHistory);

  // Selected task for slide panel
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [panelReadOnly, setPanelReadOnly] = useState(false);

  const runningSession = Object.values(sessions).find((s) => s.status === "running");

  // Real-time: subscribe to tasks-global to update agentStatus badges
  // and remove tasks when they're marked done by the MCP agent
  useEffect(() => {
    const pusher = getPusherClient();
    const channel = pusher.subscribe("tasks-global");

    channel.bind("task:updated", (data: { id: string; agent_status?: string | null; status?: string }) => {
      const agentStatus = data.agent_status ?? null;
      const status = data.status;
      setTasks((prev) => {
        if (status === "done") {
          // Remove from active list; RSC refresh will populate history
          return prev.filter((t) => t.id !== data.id);
        }
        return prev.map((t) =>
          t.id === data.id
            ? { ...t, agentStatus, ...(status ? { status: status as AgentTaskItem["status"] } : {}) }
            : t
        );
      });
      // Refresh RSC data so history tab updates after task is done
      if (status === "done") {
        router.refresh();
      }
    });

    return () => {
      channel.unbind("task:updated");
      pusher.unsubscribe("tasks-global");
    };
  }, [router]);

  // Live tick
  useEffect(() => {
    if (!runningSession) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [runningSession?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Handlers ────────────────────────────────────────────────────────────────

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
      setTodayBase((prev) => prev + done.elapsedSeconds);
      setSessions((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      if (selectedTaskId === taskId) setSelectedTaskId(null);
    } finally {
      setLoading(null);
    }
  }

  function handleUpdate(taskId: string, updates: Partial<AgentTaskItem>) {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, ...updates } : t));
  }

  function handleAddTask(task: {
    id: string; title: string; description: string | null;
    status: "todo" | "in_progress" | "review" | "done";
    priority: "low" | "medium" | "high" | "urgent";
    dueDate: string | null; projectId: string | null; agentId: string | null;
  }) {
    // Find project name from the projects list
    const projectName = projects.find((p) => p.id === task.projectId)?.name ?? null;
    setTasks((prev) => [
      ...prev,
      { ...task, projectName, agentStatus: null },
    ]);
  }

  async function handleSendToAgent(taskId: string) {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentStatus: "queued" }),
    });
    if (res.ok) {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, agentStatus: "queued" } : t))
      );
    }
  }

  function openTaskPanel(taskId: string, readOnly = false) {
    setSelectedTaskId(taskId);
    setPanelReadOnly(readOnly);
  }

  // ── Render Activas Tab ───────────────────────────────────────────────────────

  const selectedActiveTask = selectedTaskId
    ? tasks.find((t) => t.id === selectedTaskId)
    : null;

  const selectedHistoryTask = selectedTaskId
    ? historyItems.find((h) => h.taskId === selectedTaskId)
    : null;

  // Build AgentTaskItem from history for the panel
  const historyAsTask: AgentTaskItem | null = selectedHistoryTask
    ? {
        id: selectedHistoryTask.taskId,
        title: selectedHistoryTask.taskTitle,
        description: null,
        status: selectedHistoryTask.taskStatus as AgentTaskItem["status"],
        priority: selectedHistoryTask.taskPriority as AgentTaskItem["priority"],
        dueDate: null,
        projectName: selectedHistoryTask.projectName,
        projectId: selectedHistoryTask.projectId,
        agentStatus: "done",
      }
    : null;

  const panelTask = selectedActiveTask ?? historyAsTask;

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {(
          [
            { key: "activas", label: "Activas", icon: Activity, count: tasks.length },
            { key: "historial", label: "Historial", icon: History, count: historyItems.length },
            { key: "chat", label: "Chat", icon: MessageSquare, count: null },
            { key: "configurar", label: "Configurar", icon: Settings, count: null },
          ] as const
        ).map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              tab === key
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
            {count !== null && count > 0 && (
              <span className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                tab === key ? "bg-[#1e3a5f] text-white" : "bg-slate-200 text-slate-600"
              )}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "activas" && (
        <div className="space-y-6">
          {/* Metrics */}
          <div className="grid grid-cols-3 gap-4">
            <MetricCard label="Hoy" icon={<Timer className="w-3.5 h-3.5" />} value={todayLive > 0 ? formatDuration(todayLive) : "—"} />
            <MetricCard label="Tareas activas" icon={<Square className="w-3.5 h-3.5" />} value={String(tasks.length)} />
            <MetricCard
              label="En curso"
              icon={<Clock className="w-3.5 h-3.5" />}
              value={runningSession
                ? formatLive(
                    (sessions[runningSession.taskId]?.elapsedSeconds ?? 0) +
                    Math.floor((now - new Date(runningSession.startedAt).getTime()) / 1000)
                  )
                : "—"
              }
              highlight={!!runningSession}
            />
          </div>

          {/* Token consumption bar */}
          <TokenBudgetBar used={monthlyTokens} budget={agentConfig.tokenBudget} />

          <QuickAddTask
            agentId={agentId}
            projects={projects}
            onAdd={handleAddTask}
            placeholder="Agregar tarea a este agente…"
          />

          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center bg-white rounded-xl border border-slate-200">
              <CheckCircle2 className="w-10 h-10 text-emerald-300 mb-3" />
              <p className="font-semibold text-slate-700">Sin tareas pendientes</p>
              <p className="text-sm text-slate-400 mt-1">
                Usa el botón de arriba o asigna tareas desde el kanban.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => {
                const session = sessions[task.id];
                const isLoading = loading === task.id;
                const sessionId = session?.id;
                const isRunning = session?.status === "running";
                const isPaused = session?.status === "paused";
                const liveRunSeconds = isRunning
                  ? Math.floor((now - new Date(session!.startedAt).getTime()) / 1000)
                  : 0;
                const sessionSeconds = session ? session.elapsedSeconds + liveRunSeconds : 0;
                const totalSeconds = (doneTimes[task.id] ?? 0) + sessionSeconds;
                const priority = priorityConfig[task.priority];

                return (
                  <div
                    key={task.id}
                    className={cn(
                      "bg-white rounded-xl border transition-all",
                      isRunning ? "border-emerald-300 shadow-sm shadow-emerald-100"
                        : isPaused ? "border-amber-200"
                        : "border-slate-200"
                    )}
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <button
                          onClick={() => openTaskPanel(task.id, false)}
                          className="flex-1 min-w-0 text-left"
                        >
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={cn("w-2 h-2 rounded-full flex-shrink-0", priority.dot)} />
                            {isRunning && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />}
                            <p className="text-sm font-semibold text-slate-900 leading-snug truncate hover:text-[#1e3a5f] transition-colors">
                              {task.title}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-400 ml-4">
                            {task.projectName && (
                              <span className="flex items-center gap-0.5"><Folder className="w-3 h-3" />{task.projectName}</span>
                            )}
                            <span>·</span>
                            <span>{statusLabels[task.status]}</span>
                            <span>·</span>
                            <span className={priority.color}>{priority.label}</span>
                          </div>
                        </button>
                        <div className="flex-shrink-0 text-right">
                          {isRunning ? (
                            <span className="font-mono text-base font-bold text-emerald-600">{formatLive(totalSeconds)}</span>
                          ) : (
                            <span className="text-sm font-medium text-slate-500">{formatDuration(totalSeconds)}</span>
                          )}
                          {isPaused && <p className="text-[10px] text-amber-500 font-medium">pausado</p>}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                        <button
                          onClick={() => openTaskPanel(task.id, false)}
                          className="text-xs text-slate-400 hover:text-[#1e3a5f] flex items-center gap-1 transition-colors"
                        >
                          <FileText className="w-3 h-3" /> Detalles
                        </button>
                        <div className="flex items-center gap-2">
                          {task.agentStatus ? (
                            <AgentStatusBadge status={task.agentStatus} />
                          ) : (
                            <button
                              onClick={() => handleSendToAgent(task.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-500 bg-white rounded-lg text-xs font-medium hover:border-[#1e3a5f] hover:text-[#1e3a5f] transition-colors"
                            >
                              <Bot className="w-3 h-3" /> Enviar al agente
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "historial" && (
        <div>
          {historyItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-xl border border-slate-200">
              <History className="w-10 h-10 text-slate-200 mb-3" />
              <p className="font-semibold text-slate-700">Sin historial todavía</p>
              <p className="text-sm text-slate-400 mt-1">Las tareas completadas aparecerán aquí.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    <th className="text-left px-4 py-3">Tarea</th>
                    <th className="text-center px-3 py-3">Sesiones</th>
                    <th className="text-right px-3 py-3">Tiempo</th>
                    <th className="text-right px-3 py-3">Tokens</th>
                    <th className="text-right px-4 py-3">Último</th>
                  </tr>
                </thead>
                <tbody>
                  {historyItems.map((item, i) => {
                    const priority = priorityConfig[item.taskPriority as keyof typeof priorityConfig] ?? priorityConfig.medium;
                    return (
                      <tr
                        key={item.taskId}
                        onClick={() => openTaskPanel(item.taskId, true)}
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-slate-50",
                          i < historyItems.length - 1 && "border-b border-slate-100"
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={cn("w-2 h-2 rounded-full flex-shrink-0", priority.dot)} />
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 truncate max-w-[200px]">{item.taskTitle}</p>
                              {item.projectName && (
                                <p className="text-xs text-slate-400 flex items-center gap-0.5 mt-0.5">
                                  <Folder className="w-2.5 h-2.5" />{item.projectName}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="text-center px-3 py-3 text-slate-500">{item.sessionCount}</td>
                        <td className="text-right px-3 py-3 font-mono text-slate-700">{formatDuration(item.totalSeconds)}</td>
                        <td className="text-right px-3 py-3 text-slate-500">{item.totalTokens > 0 ? item.totalTokens.toLocaleString() : "—"}</td>
                        <td className="text-right px-4 py-3 text-slate-400 text-xs">{formatDate(item.lastWorked)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "chat" && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden" style={{ height: 520 }}>
          <AgentDirectChat
            agentId={agentId}
            agentName={agentName}
            agentAvatar={agentAvatar}
            agentColor={agentColor}
            currentUserId={currentUserId}
          />
        </div>
      )}

      {tab === "configurar" && (
        <ConfigTab agentId={agentId} config={agentConfig} />
      )}

      {/* Task Detail Slide Panel */}
      {panelTask && (
        <TaskDetailPanel
          task={panelTask}
          agentId={agentId}
          session={sessions[panelTask.id]}
          doneSeconds={doneTimes[panelTask.id] ?? 0}
          now={now}
          loading={loading === panelTask.id}
          onPlay={() => handlePlay(panelTask.id)}
          onPause={() => {
            const s = sessions[panelTask.id];
            if (s) handlePause(s.id, panelTask.id);
          }}
          onStop={() => {
            const s = sessions[panelTask.id];
            if (s) handleStop(s.id, panelTask.id);
          }}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={handleUpdate}
          onSendToAgent={handleSendToAgent}
          readOnly={panelReadOnly}
        />
      )}
    </div>
  );
}

// ── Metric Card ───────────────────────────────────────────────────────────────

function MetricCard({
  label,
  icon,
  value,
  highlight = false,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
      <div className="flex items-center justify-center gap-1.5 text-slate-400 text-xs mb-1">
        {icon}
        {label}
      </div>
      <p className={cn("text-lg font-bold font-mono", highlight ? "text-emerald-600" : "text-slate-900")}>
        {value}
      </p>
    </div>
  );
}
