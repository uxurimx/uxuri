"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Trash2, Pencil, Flag, Calendar, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatDate, cn } from "@/lib/utils";

const schema = z.object({
  title: z.string().min(1, "El título es requerido"),
  description: z.string().optional(),
  status: z.enum(["todo", "in_progress", "review", "done"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  dueDate: z.string().optional(),
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
};

interface TaskModalProps {
  open: boolean;
  onClose: () => void;
  task?: TaskForModal | null;
  projectId?: string;
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

export function TaskModal({ open, onClose, task, projectId, initialMode }: TaskModalProps) {
  const router = useRouter();
  const isExisting = !!task;
  const defaultMode = initialMode ?? (isExisting ? "view" : "create");
  const [mode, setMode] = useState<"view" | "edit" | "create">(defaultMode);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
      });
    } else {
      reset({ title: "", description: "", status: "todo", priority: "medium", dueDate: "" });
    }
  }, [open, task, initialMode, reset]);

  async function onSubmit(data: FormData) {
    setIsLoading(true);
    try {
      const url = isExisting ? `/api/tasks/${task.id}` : "/api/tasks";
      const method = isExisting ? "PATCH" : "POST";
      const body = isExisting
        ? { ...data, dueDate: data.dueDate || null }
        : { ...data, dueDate: data.dueDate || null, projectId };

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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
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
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-slate-900 leading-snug">{task.title}</h3>
                {task.projectName && (
                  <p className="text-xs text-slate-400 mt-0.5">{task.projectName}</p>
                )}
              </div>
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
            </div>

            {task.description && (
              <p className="text-sm text-slate-600 leading-relaxed">{task.description}</p>
            )}

            <div className="flex gap-3 pt-2 border-t border-slate-100">
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isDeleting ? "Eliminando..." : "Eliminar"}
              </button>
              <button
                onClick={() => setMode("edit")}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#162d4a] transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                Editar
              </button>
            </div>
          </div>
        )}

        {/* EDIT / CREATE MODE */}
        {(mode === "edit" || mode === "create") && (
          <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
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
