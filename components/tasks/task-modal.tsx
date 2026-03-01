"use client";

import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  X, Trash2, Pencil, Flag, Calendar, ArrowLeft, Folder, Send,
  MessageSquare, UserCircle, PlusCircle, ArrowRightLeft,
  FileText, Clock, UserCheck, UserMinus, History, CheckCircle2,
} from "lucide-react";
import { MentionInput, renderWithMentions } from "./mention-input";
import { useRouter } from "next/navigation";
import { formatDate, formatDateTime, cn } from "@/lib/utils";

const schema = z.object({
  title: z.string().min(1, "El título es requerido"),
  description: z.string().optional(),
  status: z.enum(["todo", "in_progress", "review", "done"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  dueDate: z.string().optional(),
  projectId: z.string().optional(),
  assignedTo: z.string().optional(),
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
  createdBy?: string | null;
  personalDone?: boolean;
};

type Comment = {
  id: string;
  userId: string;
  userName: string | null;
  content: string;
  createdAt: string;
};

type ActivityEvent = {
  id: string;
  taskId: string;
  userId: string | null;
  userName: string | null;
  type: "created" | "status_changed" | "priority_changed" | "assigned" | "unassigned" |
        "title_changed" | "description_changed" | "due_date_changed" | "commented";
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
};

type Project = { id: string; name: string };
type User = { id: string; name: string | null };

interface TaskModalProps {
  open: boolean;
  onClose: () => void;
  task?: TaskForModal | null;
  projectId?: string;
  projects?: Project[];
  users?: User[];
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
                "border-emerald-200":   event.type === "created",
                "border-blue-200":      event.type === "status_changed",
                "border-amber-200":     event.type === "priority_changed",
                "border-violet-200":    event.type === "assigned",
                "border-slate-200":     event.type === "unassigned" || event.type === "title_changed" || event.type === "description_changed",
                "border-teal-200":      event.type === "due_date_changed",
                "border-indigo-200":    event.type === "commented",
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
  const [activeTab, setActiveTab] = useState<"comments" | "details">("comments");

  // Comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Activity state
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Personal done
  const [markingDone, setMarkingDone] = useState(false);

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
      });
    } else {
      reset({ title: "", description: "", status: "todo", priority: "medium", dueDate: today(), projectId: projectId ?? "", assignedTo: "" });
    }
  }, [open, task, initialMode, projectId, reset]);

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

  // Load activity when switching to details tab
  useEffect(() => {
    if (!open || !task?.id || mode !== "view" || activeTab !== "details") return;
    if (activity.length > 0) return; // already loaded
    setActivityLoading(true);
    fetch(`/api/tasks/${task.id}/activity`)
      .then((r) => r.json())
      .then((data) => setActivity(Array.isArray(data) ? data : []))
      .catch(() => setActivity([]))
      .finally(() => setActivityLoading(false));
  }, [open, task?.id, mode, activeTab, activity.length]);

  // Reset activity cache when task changes
  useEffect(() => {
    setActivity([]);
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
              </div>

              {task.description && (
                <p className="text-sm text-slate-600 leading-relaxed">{task.description}</p>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2 border-t border-slate-100">
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
                {isOwner && (
                  <button
                    onClick={() => setMode("edit")}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#162d4a] transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Editar
                  </button>
                )}

                {/* Third-party: personal done button */}
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

                {/* Already marked as personal done */}
                {isThirdParty && task.personalDone && (
                  <div className="flex-1 flex items-center gap-2">
                    <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      Marcada como hecha para ti
                    </span>
                  </div>
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
                      {comments.map((c) => (
                        <div key={c.id} className="bg-slate-50 rounded-lg p-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-xs font-semibold text-slate-700">{c.userName ?? "Usuario"}</span>
                            <span className="text-xs text-slate-400">·</span>
                            <span className="text-xs text-slate-400">{formatDateTime(c.createdAt)}</span>
                          </div>
                          <p className="text-sm text-slate-600 leading-relaxed">{renderWithMentions(c.content)}</p>
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
                      placeholder="Escribe un comentario... usa @ para mencionar"
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Asignar a</label>
                <select {...register("assignedTo")} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20">
                  <option value="">Sin asignar</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name ?? u.id}</option>
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
