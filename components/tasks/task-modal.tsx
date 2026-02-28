"use client";

import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Trash2, Pencil, Flag, Calendar, ArrowLeft, Folder, Send, MessageSquare, UserCircle } from "lucide-react";
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
};

type Comment = {
  id: string;
  userId: string;
  userName: string | null;
  content: string;
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

  const defaultMode = initialMode ?? (isExisting ? "view" : "create");
  const [mode, setMode] = useState<"view" | "edit" | "create">(defaultMode);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: "todo", priority: "medium" },
  });

  useEffect(() => {
    if (!open) return;
    const m = initialMode ?? (task ? "view" : "create");
    setMode(m);
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

  // Cargar comentarios cuando se abre en modo vista
  useEffect(() => {
    if (!open || !task?.id || mode !== "view") return;
    setCommentsLoading(true);
    fetch(`/api/tasks/${task.id}/comments`)
      .then((r) => r.json())
      .then((data) => setComments(Array.isArray(data) ? data : []))
      .catch(() => setComments([]))
      .finally(() => setCommentsLoading(false));
  }, [open, task?.id, mode]);

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
        setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
    } finally {
      setSendingComment(false);
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

              {/* Actions — solo el creador puede editar/eliminar */}
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
                {!isOwner && (
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    Solo el creador puede editar o eliminar esta tarea
                  </p>
                )}
              </div>

              {/* Comments */}
              <div className="pt-2">
                <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-3">
                  <MessageSquare className="w-4 h-4 text-slate-400" />
                  Comentarios
                  {comments.length > 0 && (
                    <span className="text-xs font-normal text-slate-400">({comments.length})</span>
                  )}
                </h4>

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
                        <p className="text-sm text-slate-600 leading-relaxed">{c.content}</p>
                      </div>
                    ))}
                    <div ref={commentsEndRef} />
                  </div>
                )}

                {/* Add comment */}
                <div className="flex gap-2 mt-2">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendComment(); }
                    }}
                    rows={2}
                    placeholder="Escribe un comentario... (Enter para enviar)"
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 resize-none"
                  />
                  <button
                    onClick={sendComment}
                    disabled={sendingComment || !commentText.trim()}
                    className="px-3 py-2 bg-[#1e3a5f] text-white rounded-lg hover:bg-[#162d4a] transition-colors disabled:opacity-40 flex items-center"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
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
