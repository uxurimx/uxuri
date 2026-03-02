"use client";

import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  X, Trash2, Pencil, Flag, Calendar, ArrowLeft, Folder, Send,
  MessageSquare, UserCircle, PlusCircle, ArrowRightLeft,
  FileText, Clock, UserCheck, UserMinus, History, CheckCircle2,
  Play, Pause, StopCircle, Bot, ListChecks, Plus,
} from "lucide-react";
import { AgentChat } from "@/components/agents/agent-chat";
import { MentionInput, renderWithMentions } from "./mention-input";
import { useRouter } from "next/navigation";
import { formatDate, formatDateTime, cn } from "@/lib/utils";
import { getPusherClient } from "@/lib/pusher";

const schema = z.object({
  title: z.string().min(1, "El título es requerido"),
  description: z.string().optional(),
  status: z.enum(["todo", "in_progress", "review", "done"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  dueDate: z.string().optional(),
  projectId: z.string().optional(),
  assignedTo: z.string().optional(),
  agentId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export type TaskForModal = {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: string | null;
  projectId?: string | null;
  projectName?: string | null;
  assignedTo?: string | null;
  agentId?: string | null;
  agentStatus?: string | null;
  createdBy?: string | null;
  personalDone?: boolean;
};

type Comment = {
  id: string;
  userId: string | null;
  userName: string | null;
  content: string;
  createdAt: string;
};

type TypingAgent = { agentId: string; agentName: string; agentAvatar: string };

type Subtask = {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
  sortOrder: number;
  createdAt: string;
};

type ActivityEvent = {
  id: string;
  taskId: string;
  userId: string | null;
  userName: string | null;
  type: "created" | "status_changed" | "priority_changed" | "assigned" | "unassigned" |
        "title_changed" | "description_changed" | "due_date_changed" | "commented" |
        "session_started" | "session_paused" | "session_stopped" | "agent_status_changed";
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
};

type Project = { id: string; name: string };
type User = { id: string; name: string | null };
type AgentOption = { id: string; name: string; avatar: string; color: string };

interface TaskModalProps {
  open: boolean;
  onClose: () => void;
  task?: TaskForModal | null;
  projectId?: string;
  projects?: Project[];
  users?: User[];
  agents?: AgentOption[];
  currentUserId?: string;
  initialMode?: "view" | "edit" | "create";
}

const statusConfig = {
  todo:        { label: "Por hacer",   className: "bg-slate-100 text-slate-600" },
  in_progress: { label: "En progreso", className: "bg-blue-50 text-blue-700" },
  review:      { label: "Revisión",    className: "bg-purple-50 text-purple-700" },
  done:        { label: "Hecho",       className: "bg-emerald-50 text-emerald-700" },
};

const priorityConfig = {
  low:    { label: "Baja",    color: "text-slate-400" },
  medium: { label: "Media",   color: "text-amber-500" },
  high:   { label: "Alta",    color: "text-orange-500" },
  urgent: { label: "Urgente", color: "text-red-500" },
};

// ─── Activity helpers ────────────────────────────────────────────────────────

function fmtSecs(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

const activityMeta: Record<
  ActivityEvent["type"],
  { icon: React.ComponentType<{ className?: string }>; color: string; label: (e: ActivityEvent) => string }
> = {
  created: {
    icon: PlusCircle,
    color: "text-emerald-500",
    label: (e) => `${e.userName ?? "Usuario"} creó la tarea`,
  },
  status_changed: {
    icon: ArrowRightLeft,
    color: "text-blue-500",
    label: (e) =>
      e.oldValue && e.newValue
        ? `${e.userName ?? "Usuario"} cambió el estado de "${e.oldValue}" a "${e.newValue}"`
        : `${e.userName ?? "Usuario"} cambió el estado`,
  },
  priority_changed: {
    icon: Flag,
    color: "text-amber-500",
    label: (e) =>
      e.oldValue && e.newValue
        ? `${e.userName ?? "Usuario"} cambió la prioridad de "${e.oldValue}" a "${e.newValue}"`
        : `${e.userName ?? "Usuario"} cambió la prioridad`,
  },
  assigned: {
    icon: UserCheck,
    color: "text-violet-500",
    label: (e) =>
      e.newValue
        ? `${e.userName ?? "Usuario"} asignó la tarea a ${e.newValue}`
        : `${e.userName ?? "Usuario"} asignó la tarea`,
  },
  unassigned: {
    icon: UserMinus,
    color: "text-slate-400",
    label: (e) => `${e.userName ?? "Usuario"} quitó la asignación`,
  },
  title_changed: {
    icon: Pencil,
    color: "text-slate-500",
    label: (e) =>
      e.newValue
        ? `${e.userName ?? "Usuario"} renombró la tarea a "${e.newValue}"`
        : `${e.userName ?? "Usuario"} cambió el título`,
  },
  description_changed: {
    icon: FileText,
    color: "text-slate-500",
    label: (e) => `${e.userName ?? "Usuario"} actualizó la descripción`,
  },
  due_date_changed: {
    icon: Calendar,
    color: "text-teal-500",
    label: (e) =>
      e.newValue
        ? `${e.userName ?? "Usuario"} cambió la fecha límite a ${formatDate(e.newValue)}`
        : `${e.userName ?? "Usuario"} eliminó la fecha límite`,
  },
  commented: {
    icon: MessageSquare,
    color: "text-indigo-500",
    label: (e) => `${e.userName ?? "Usuario"} comentó`,
  },
  session_started: {
    icon: Play,
    color: "text-emerald-500",
    label: (e) => `${e.userName ?? "Agente"} inició el trabajo`,
  },
  session_paused: {
    icon: Pause,
    color: "text-amber-500",
    label: (e) => {
      const secs = parseInt(e.newValue ?? "0");
      return `${e.userName ?? "Agente"} pausó el trabajo${secs > 0 ? ` · ${fmtSecs(secs)} acumulados` : ""}`;
    },
  },
  session_stopped: {
    icon: StopCircle,
    color: "text-blue-500",
    label: (e) => {
      const secs = parseInt(e.newValue ?? "0");
      return `${e.userName ?? "Agente"} terminó la tarea${secs > 0 ? ` · Total: ${fmtSecs(secs)}` : ""}`;
    },
  },
  agent_status_changed: {
    icon: Bot,
    color: "text-[#1e3a5f]",
    label: (e) =>
      e.oldValue && e.newValue
        ? `Agente IA: ${e.oldValue} → ${e.newValue}`
        : e.newValue
        ? `Agente IA cambió estado a ${e.newValue}`
        : `Agente IA actualizó el estado`,
  },
};

function ActivityTimeline({ events, loading }: { events: ActivityEvent[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-slate-400 text-sm">
        <Clock className="w-4 h-4 animate-pulse" />
        Cargando historial...
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-slate-400">
        <History className="w-8 h-8 opacity-30" />
        <p className="text-sm">Sin actividad registrada</p>
        <p className="text-xs opacity-70">Las acciones futuras aparecerán aquí</p>
      </div>
    );
  }

  return (
    <ol className="relative">
      {events.map((event, idx) => {
        const meta = activityMeta[event.type];
        const Icon = meta.icon;
        const isLast = idx === events.length - 1;

        return (
          <li key={event.id} className="flex gap-3">
            {/* Vertical line + icon */}
            <div className="flex flex-col items-center flex-shrink-0 w-6">
              <div className={cn("w-6 h-6 rounded-full flex items-center justify-center bg-white border-2 z-10 flex-shrink-0", {
                "border-emerald-200":   event.type === "created" || event.type === "session_started",
                "border-blue-200":      event.type === "status_changed" || event.type === "session_stopped",
                "border-amber-200":     event.type === "priority_changed" || event.type === "session_paused",
                "border-violet-200":    event.type === "assigned",
                "border-slate-200":     event.type === "unassigned" || event.type === "title_changed" || event.type === "description_changed",
                "border-teal-200":      event.type === "due_date_changed",
                "border-indigo-200":    event.type === "commented",
                "border-[#1e3a5f]/30": event.type === "agent_status_changed",
              })}>
                <Icon className={cn("w-3 h-3", meta.color)} />
              </div>
              {!isLast && <div className="w-px flex-1 bg-slate-100 my-1" />}
            </div>

            {/* Content */}
            <div className={cn("flex-1 pb-4", isLast && "pb-1")}>
              <p className="text-sm text-slate-700 leading-snug">{meta.label(event)}</p>

              {/* Extra detail for comments */}
              {event.type === "commented" && event.newValue && (
                <p className="mt-1 text-xs text-slate-500 bg-slate-50 rounded-lg px-2.5 py-1.5 leading-relaxed border border-slate-100 line-clamp-3">
                  {event.newValue.length > 150 ? `${event.newValue.slice(0, 150)}…` : event.newValue}
                </p>
              )}

              {/* Timestamp */}
              <p className="mt-0.5 text-[10px] text-slate-400">{formatDateTime(event.createdAt)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().split("T")[0];
}

export function TaskModal({
  open,
  onClose,
  task,
  projectId,
  projects,
  users,
  agents,
  currentUserId,
  initialMode,
}: TaskModalProps) {
  const router = useRouter();
  const isExisting = !!task;
  const isOwner = !task?.createdBy || task.createdBy === currentUserId;
  const isAssigned = !!currentUserId && task?.assignedTo === currentUserId;
  const isThirdParty = isExisting && !isOwner && !isAssigned;

  const defaultMode = initialMode ?? (isExisting ? "view" : "create");
  const [mode, setMode] = useState<"view" | "edit" | "create">(defaultMode);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // View tabs
  const [activeTab, setActiveTab] = useState<"comments" | "details" | "agente">("comments");

  // Comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Activity state
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Typing indicator for AI agents
  const [typingAgents, setTypingAgents] = useState<TypingAgent[]>([]);

  // Personal done
  const [markingDone, setMarkingDone] = useState(false);

  // Subtasks
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [subtasksLoading, setSubtasksLoading] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [showSubtaskInput, setShowSubtaskInput] = useState(false);
  const subtaskInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: "todo", priority: "medium" },
  });

  useEffect(() => {
    if (!open) return;
    const m = initialMode ?? (task ? "view" : "create");
    setMode(m);
    setActiveTab("comments");
    if (task) {
      reset({
        title: task.title,
        description: task.description ?? "",
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate ?? "",
        projectId: task.projectId ?? "",
        assignedTo: task.assignedTo ?? "",
        agentId: task.agentId ?? "",
      });
    } else {
      reset({ title: "", description: "", status: "todo", priority: "medium", dueDate: today(), projectId: projectId ?? "", assignedTo: "", agentId: "" });
    }
  }, [open, task, initialMode, projectId, reset]);

  // Load subtasks when in view mode
  useEffect(() => {
    if (!open || !task?.id || mode !== "view") return;
    setSubtasksLoading(true);
    fetch(`/api/tasks/${task.id}/subtasks`)
      .then((r) => r.json())
      .then((data) => setSubtasks(Array.isArray(data) ? data : []))
      .catch(() => setSubtasks([]))
      .finally(() => setSubtasksLoading(false));
  }, [open, task?.id, mode]);

  // Load comments when in view mode + comments tab
  useEffect(() => {
    if (!open || !task?.id || mode !== "view") return;
    setCommentsLoading(true);
    fetch(`/api/tasks/${task.id}/comments`)
      .then((r) => r.json())
      .then((data) => setComments(Array.isArray(data) ? data : []))
      .catch(() => setComments([]))
      .finally(() => setCommentsLoading(false));
  }, [open, task?.id, mode]);

  // Load activity when switching to details tab (always fresh)
  useEffect(() => {
    if (!open || !task?.id || mode !== "view" || activeTab !== "details") return;
    setActivityLoading(true);
    fetch(`/api/tasks/${task.id}/activity`)
      .then((r) => r.json())
      .then((data) => setActivity(Array.isArray(data) ? data : []))
      .catch(() => setActivity([]))
      .finally(() => setActivityLoading(false));
  }, [open, task?.id, mode, activeTab]);

  // Real-time: comments and activity updates
  useEffect(() => {
    if (!task?.id) return;
    const pusher = getPusherClient();
    const channel = pusher.subscribe(`task-${task.id}`);

    // New comment (from another session or AI agent response)
    channel.bind("comment:created", (newComment: Comment) => {
      setComments((prev) => {
        if (prev.some((c) => c.id === newComment.id)) return prev;
        return [...prev, newComment];
      });
      // Clear typing indicator for this agent
      if (newComment.userId === null) {
        setTypingAgents([]);
      }
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    });

    // AI agent started typing
    channel.bind("comment:typing", (data: TypingAgent) => {
      setTypingAgents((prev) =>
        prev.some((a) => a.agentId === data.agentId) ? prev : [...prev, data]
      );
    });

    // AI agent stopped typing
    channel.bind("comment:typing-stop", ({ agentId }: { agentId: string }) => {
      setTypingAgents((prev) => prev.filter((a) => a.agentId !== agentId));
    });

    // Activity timeline refresh
    channel.bind("task:activity-updated", () => {
      fetch(`/api/tasks/${task.id}/activity`)
        .then((r) => r.json())
        .then((data) => setActivity(Array.isArray(data) ? data : []))
        .catch(() => {});
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(`task-${task.id}`);
    };
  }, [task?.id]);

  async function onSubmit(data: FormData) {
    setIsLoading(true);
    try {
      const url = isExisting ? `/api/tasks/${task.id}` : "/api/tasks";
      const method = isExisting ? "PATCH" : "POST";
      const body = {
        ...data,
        dueDate: data.dueDate || null,
        projectId: data.projectId || null,
        assignedTo: data.assignedTo || null,
        agentId: data.agentId || null,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) { router.refresh(); onClose(); }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete() {
    if (!task || !confirm("¿Eliminar esta tarea? Esta acción no se puede deshacer.")) return;
    setIsDeleting(true);
    try {
      await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      router.refresh();
      onClose();
    } finally {
      setIsDeleting(false);
    }
  }

  async function sendComment() {
    if (!task || !commentText.trim()) return;
    setSendingComment(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentText.trim() }),
      });
      if (res.ok) {
        const comment = await res.json();
        setComments((prev) => [...prev, comment]);
        setCommentText("");
        // Invalidate activity cache so it reloads next time
        setActivity([]);
        setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
    } finally {
      setSendingComment(false);
    }
  }

  async function handleAddSubtask() {
    if (!task || !newSubtaskTitle.trim()) return;
    setAddingSubtask(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/subtasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newSubtaskTitle.trim() }),
      });
      if (res.ok) {
        const sub = await res.json();
        setSubtasks((prev) => [...prev, sub]);
        setNewSubtaskTitle("");
        setShowSubtaskInput(false);
      }
    } finally {
      setAddingSubtask(false);
    }
  }

  async function handleToggleSubtask(sub: Subtask) {
    const updated = { ...sub, done: !sub.done };
    setSubtasks((prev) => prev.map((s) => s.id === sub.id ? updated : s));
    await fetch(`/api/tasks/${task!.id}/subtasks/${sub.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !sub.done }),
    }).catch(() => {
      // revert on error
      setSubtasks((prev) => prev.map((s) => s.id === sub.id ? sub : s));
    });
  }

  async function handleDeleteSubtask(subId: string) {
    setSubtasks((prev) => prev.filter((s) => s.id !== subId));
    await fetch(`/api/tasks/${task!.id}/subtasks/${subId}`, { method: "DELETE" }).catch(() => {
      // revert is complex; just reload
      fetch(`/api/tasks/${task!.id}/subtasks`).then((r) => r.json()).then(setSubtasks).catch(() => {});
    });
  }

  async function handleMarkDone() {
    if (!task) return;
    setMarkingDone(true);
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      router.refresh();
      onClose();
    } finally {
      setMarkingDone(false);
    }
  }

  async function handlePersonalDone() {
    if (!task) return;
    setMarkingDone(true);
    try {
      await fetch(`/api/tasks/${task.id}/preferences`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personalDone: true }),
      });
      router.refresh();
      onClose();
    } finally {
      setMarkingDone(false);
    }
  }

  if (!open) return null;

  const taskProjectName = task?.projectName
    ?? projects?.find((p) => p.id === task?.projectId)?.name
    ?? null;

  const assignedUser = task?.assignedTo
    ? (users?.find((u) => u.id === task.assignedTo) ?? null)
    : null;

  const assignedAgent = task?.agentId
    ? (agents?.find((a) => a.id === task.agentId) ?? null)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            {mode === "edit" && isExisting && (
              <button onClick={() => setMode("view")} className="text-slate-400 hover:text-slate-600 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="text-lg font-semibold text-slate-900">
              {mode === "create" ? "Nueva tarea" : mode === "edit" ? "Editar tarea" : "Detalle de tarea"}
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* VIEW MODE */}
        {mode === "view" && task && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Task info */}
              <div>
                <h3 className="text-xl font-semibold text-slate-900 leading-snug">{task.title}</h3>
                {taskProjectName && (
                  <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                    <Folder className="w-3 h-3" />
                    {taskProjectName}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium", statusConfig[task.status].className)}>
                  {statusConfig[task.status].label}
                </span>
                <span className={cn("flex items-center gap-1 text-xs font-medium", priorityConfig[task.priority].color)}>
                  <Flag className="w-3 h-3" />
                  {priorityConfig[task.priority].label}
                </span>
                {task.dueDate && (
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <Calendar className="w-3 h-3" />
                    {formatDate(task.dueDate)}
                  </span>
                )}
                {assignedUser && (
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <UserCircle className="w-3 h-3" />
                    {assignedUser.name ?? "Usuario"}
                  </span>
                )}
                {assignedAgent && (
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <span
                      className="w-4 h-4 rounded-full flex items-center justify-center text-[10px]"
                      style={{ backgroundColor: assignedAgent.color + "25" }}
                    >
                      {assignedAgent.avatar}
                    </span>
                    {assignedAgent.name}
                  </span>
                )}
              </div>

              {task.description && (
                <p className="text-sm text-slate-600 leading-relaxed">{task.description}</p>
              )}

              {/* ── Subtasks ── */}
              <div className="space-y-2">
                {/* Header with progress */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ListChecks className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-600">Subtareas</span>
                    {subtasks.length > 0 && (
                      <span className="text-xs text-slate-400">
                        {subtasks.filter((s) => s.done).length}/{subtasks.length}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => { setShowSubtaskInput(true); setTimeout(() => subtaskInputRef.current?.focus(), 50); }}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-[#1e3a5f] transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Añadir
                  </button>
                </div>

                {/* Progress bar */}
                {subtasks.length > 0 && (
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        subtasks.filter((s) => s.done).length >= subtasks.length
                          ? "bg-emerald-500"
                          : "bg-[#1e3a5f]"
                      )}
                      style={{ width: `${subtasks.length ? Math.round((subtasks.filter((s) => s.done).length / subtasks.length) * 100) : 0}%` }}
                    />
                  </div>
                )}

                {/* List */}
                {subtasksLoading ? (
                  <p className="text-xs text-slate-400">Cargando...</p>
                ) : (
                  <ul className="space-y-1">
                    {subtasks.map((sub) => (
                      <li key={sub.id} className="group flex items-center gap-2">
                        <button
                          onClick={() => handleToggleSubtask(sub)}
                          className={cn(
                            "w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors",
                            sub.done
                              ? "bg-emerald-500 border-emerald-500"
                              : "border-slate-300 hover:border-[#1e3a5f]"
                          )}
                        >
                          {sub.done && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </button>
                        <span className={cn("flex-1 text-sm", sub.done && "line-through text-slate-400")}>
                          {sub.title}
                        </span>
                        <button
                          onClick={() => handleDeleteSubtask(sub.id)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-300 hover:text-red-500 transition-all"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* New subtask input */}
                {showSubtaskInput && (
                  <div className="flex gap-1.5 mt-1">
                    <input
                      ref={subtaskInputRef}
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddSubtask();
                        if (e.key === "Escape") { setShowSubtaskInput(false); setNewSubtaskTitle(""); }
                      }}
                      placeholder="Nueva subtarea..."
                      className="flex-1 text-sm px-2.5 py-1 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                    />
                    <button
                      onClick={handleAddSubtask}
                      disabled={addingSubtask || !newSubtaskTitle.trim()}
                      className="px-2.5 py-1 bg-[#1e3a5f] text-white rounded-lg text-xs disabled:opacity-40 transition-colors"
                    >
                      {addingSubtask ? "..." : "Añadir"}
                    </button>
                    <button
                      onClick={() => { setShowSubtaskInput(false); setNewSubtaskTitle(""); }}
                      className="px-2 py-1 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                {/* Delete — owner only */}
                {isOwner && (
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {isDeleting ? "Eliminando..." : "Eliminar"}
                  </button>
                )}

                {/* Mark as done — owner or assigned, only when not already done */}
                {(isOwner || isAssigned) && task.status !== "done" && (
                  <button
                    onClick={handleMarkDone}
                    disabled={markingDone}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {markingDone ? "Guardando..." : "Marcar como hecha"}
                  </button>
                )}

                {/* Already done indicator — owner or assigned */}
                {(isOwner || isAssigned) && task.status === "done" && (
                  <span className="flex-1 flex items-center gap-1.5 text-sm text-emerald-600 font-medium py-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Tarea completada
                  </span>
                )}

                {/* Edit — owner only */}
                {isOwner && (
                  <button
                    onClick={() => setMode("edit")}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#162d4a] transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Editar
                  </button>
                )}

                {/* Third-party: personal done */}
                {isThirdParty && !task.personalDone && (
                  <button
                    onClick={handlePersonalDone}
                    disabled={markingDone}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {markingDone ? "Guardando..." : "Hecho para mí"}
                  </button>
                )}
                {isThirdParty && task.personalDone && (
                  <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium py-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Marcada como hecha para ti
                  </span>
                )}
              </div>

              {/* ── Tabs ── */}
              <div className="border-b border-slate-100">
                <div className="flex gap-0">
                  <button
                    onClick={() => setActiveTab("comments")}
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
                      activeTab === "comments"
                        ? "border-[#1e3a5f] text-[#1e3a5f]"
                        : "border-transparent text-slate-500 hover:text-slate-700"
                    )}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Comentarios
                    {comments.length > 0 && (
                      <span className="text-[10px] bg-slate-100 text-slate-500 rounded-full px-1.5 py-0.5 font-normal">
                        {comments.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab("details")}
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
                      activeTab === "details"
                        ? "border-[#1e3a5f] text-[#1e3a5f]"
                        : "border-transparent text-slate-500 hover:text-slate-700"
                    )}
                  >
                    <History className="w-3.5 h-3.5" />
                    Detalles
                  </button>
                  {task?.agentId && (
                    <button
                      onClick={() => setActiveTab("agente")}
                      className={cn(
                        "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
                        activeTab === "agente"
                          ? "border-[#1e3a5f] text-[#1e3a5f]"
                          : "border-transparent text-slate-500 hover:text-slate-700"
                      )}
                    >
                      <Bot className="w-3.5 h-3.5" />
                      Agente
                    </button>
                  )}
                </div>
              </div>

              {/* ── Comments tab ── */}
              {activeTab === "comments" && (
                <div>
                  {commentsLoading ? (
                    <p className="text-xs text-slate-400 py-2">Cargando...</p>
                  ) : comments.length === 0 ? (
                    <p className="text-xs text-slate-400 py-2">Sin comentarios aún.</p>
                  ) : (
                    <div className="space-y-3 mb-3">
                      {comments.map((c) => {
                        const isAI = c.userId === null;
                        return (
                          <div
                            key={c.id}
                            className={cn(
                              "rounded-lg p-3",
                              isAI
                                ? "bg-violet-50 border border-violet-100"
                                : "bg-slate-50"
                            )}
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              {isAI && <Bot className="w-3 h-3 text-violet-500 flex-shrink-0" />}
                              <span
                                className={cn(
                                  "text-xs font-semibold",
                                  isAI ? "text-violet-700" : "text-slate-700"
                                )}
                              >
                                {c.userName ?? (isAI ? "Agente IA" : "Usuario")}
                              </span>
                              <span className="text-xs text-slate-400">·</span>
                              <span className="text-xs text-slate-400">
                                {formatDateTime(c.createdAt)}
                              </span>
                            </div>
                            <p className="text-sm text-slate-600 leading-relaxed">
                              {renderWithMentions(c.content)}
                            </p>
                          </div>
                        );
                      })}

                      {/* Typing indicators */}
                      {typingAgents.map((a) => (
                        <div
                          key={a.agentId}
                          className="bg-violet-50 border border-violet-100 rounded-lg p-3 flex items-center gap-2"
                        >
                          <span className="text-sm">{a.agentAvatar}</span>
                          <span className="text-xs text-violet-600">{a.agentName}</span>
                          <span className="flex gap-0.5 ml-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:0ms]" />
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:150ms]" />
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:300ms]" />
                          </span>
                        </div>
                      ))}

                      <div ref={commentsEndRef} />
                    </div>
                  )}

                  {/* Add comment */}
                  <div className="flex gap-2 mt-2">
                    <MentionInput
                      value={commentText}
                      onChange={setCommentText}
                      users={users ?? []}
                      agents={agents?.map((a) => ({ id: a.id, name: a.name, avatar: a.avatar }))}
                      placeholder="Escribe un comentario… usa @ para mencionar"
                      onEnter={sendComment}
                      disabled={sendingComment}
                    />
                    <button
                      onClick={sendComment}
                      disabled={sendingComment || !commentText.trim()}
                      className="px-3 py-2 bg-[#1e3a5f] text-white rounded-lg hover:bg-[#162d4a] transition-colors disabled:opacity-40 flex items-center self-end"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* ── Details / Timeline tab ── */}
              {activeTab === "details" && (
                <div className="pt-1">
                  <ActivityTimeline events={activity} loading={activityLoading} />
                </div>
              )}

              {/* ── Agente tab ── */}
              {activeTab === "agente" && task?.agentId && (
                <div className="pt-3">
                  <AgentChat taskId={task.id} agentStatus={task.agentStatus ?? null} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* EDIT / CREATE MODE */}
        {(mode === "edit" || mode === "create") && (
          <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4 overflow-y-auto flex-1">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Título *</label>
              <input
                {...register("title")}
                autoFocus
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                placeholder="Título de la tarea"
              />
              {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
              <textarea
                {...register("description")}
                rows={2}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 resize-none"
                placeholder="Descripción opcional..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
                <select {...register("status")} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20">
                  <option value="todo">Por hacer</option>
                  <option value="in_progress">En progreso</option>
                  <option value="review">Revisión</option>
                  <option value="done">Hecho</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Prioridad</label>
                <select {...register("priority")} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20">
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
            </div>

            {projects && projects.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Proyecto</label>
                <select {...register("projectId")} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20">
                  <option value="">Sin proyecto</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}

            {users && users.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Asignar a persona</label>
                <select {...register("assignedTo")} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20">
                  <option value="">Sin asignar</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name ?? u.id}</option>
                  ))}
                </select>
              </div>
            )}

            {agents && agents.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Asignar a agente</label>
                <select {...register("agentId")} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20">
                  <option value="">Sin agente</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.avatar} {a.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fecha límite</label>
              <input {...register("dueDate")} type="date" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20" />
            </div>

            <div className="flex gap-3 pt-2">
              {mode === "edit" && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {isDeleting ? "..." : "Eliminar"}
                </button>
              )}
              <div className="flex gap-3 flex-1 justify-end">
                <button type="button" onClick={mode === "edit" && isExisting ? () => setMode("view") : onClose} className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={isLoading} className="px-5 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#162d4a] transition-colors disabled:opacity-50">
                  {isLoading ? "Guardando..." : mode === "edit" ? "Guardar" : "Crear tarea"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
