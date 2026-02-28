"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { X, Trash2, Pencil, Calendar, User, Flag, ArrowLeft, ExternalLink } from "lucide-react";
import { formatDate, cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  description: z.string().optional(),
  clientId: z.string().optional(),
  status: z.enum(["planning", "active", "paused", "completed", "cancelled"]),
  priority: z.enum(["low", "medium", "high"]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export type ProjectForModal = {
  id: string;
  name: string;
  description: string | null;
  clientId: string | null;
  clientName: string | null;
  status: "planning" | "active" | "paused" | "completed" | "cancelled";
  priority: "low" | "medium" | "high";
  startDate: string | null;
  endDate: string | null;
};

type Client = { id: string; name: string };

interface ProjectModalProps {
  open: boolean;
  onClose: () => void;
  project: ProjectForModal;
  clients: Client[];
  initialMode?: "view" | "edit";
}

const statusConfig = {
  planning:  { label: "Planeación", className: "bg-slate-100 text-slate-600" },
  active:    { label: "Activo",     className: "bg-emerald-50 text-emerald-700" },
  paused:    { label: "Pausado",    className: "bg-amber-50 text-amber-700" },
  completed: { label: "Completado", className: "bg-blue-50 text-blue-700" },
  cancelled: { label: "Cancelado",  className: "bg-red-50 text-red-700" },
};

const priorityConfig = {
  low:    { label: "Baja",  className: "text-slate-400" },
  medium: { label: "Media", className: "text-amber-500" },
  high:   { label: "Alta",  className: "text-orange-500" },
};

export function ProjectModal({ open, onClose, project, clients, initialMode = "view" }: ProjectModalProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit">(initialMode);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    reset({
      name: project.name,
      description: project.description ?? "",
      clientId: project.clientId ?? "",
      status: project.status,
      priority: project.priority,
      startDate: project.startDate ?? "",
      endDate: project.endDate ?? "",
    });
  }, [open, project, initialMode, reset]);

  async function onSubmit(data: FormData) {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          clientId: data.clientId || null,
          startDate: data.startDate || null,
          endDate: data.endDate || null,
        }),
      });
      if (res.ok) { onClose(); router.refresh(); }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("¿Eliminar este proyecto? Las tareas asociadas quedarán sin proyecto asignado.")) return;
    setIsDeleting(true);
    try {
      await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      onClose();
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            {mode === "edit" && (
              <button onClick={() => setMode("view")} className="text-slate-400 hover:text-slate-600 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="text-lg font-semibold text-slate-900">
              {mode === "view" ? "Detalle del proyecto" : "Editar proyecto"}
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* VIEW MODE */}
        {mode === "view" && (
          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            <div>
              <h3 className="text-xl font-semibold text-slate-900 leading-snug">{project.name}</h3>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium", statusConfig[project.status].className)}>
                {statusConfig[project.status].label}
              </span>
              <span className={cn("flex items-center gap-1 text-xs font-medium", priorityConfig[project.priority].className)}>
                <Flag className="w-3 h-3" />
                {priorityConfig[project.priority].label}
              </span>
            </div>

            {project.description && (
              <p className="text-sm text-slate-600 leading-relaxed">{project.description}</p>
            )}

            <div className="space-y-2 text-sm text-slate-600">
              {project.clientName && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span>{project.clientName}</span>
                </div>
              )}
              {(project.startDate || project.endDate) && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span>
                    {project.startDate ? formatDate(project.startDate) : "—"}
                    {" → "}
                    {project.endDate ? formatDate(project.endDate) : "Sin fecha fin"}
                  </span>
                </div>
              )}
            </div>

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
                onClick={() => { onClose(); router.push(`/projects/${project.id}`); }}
                className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-50 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Ver proyecto
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

        {/* EDIT MODE */}
        {mode === "edit" && (
          <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4 overflow-y-auto flex-1">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
              <input
                {...register("name")}
                autoFocus
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
              <textarea
                {...register("description")}
                rows={2}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
                <select {...register("status")} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20">
                  <option value="planning">Planeación</option>
                  <option value="active">Activo</option>
                  <option value="paused">Pausado</option>
                  <option value="completed">Completado</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Prioridad</label>
                <select {...register("priority")} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20">
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cliente</label>
              <select {...register("clientId")} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20">
                <option value="">Sin cliente</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha inicio</label>
                <input {...register("startDate")} type="date" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha fin</label>
                <input {...register("endDate")} type="date" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20" />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isDeleting ? "..." : "Eliminar"}
              </button>
              <div className="flex gap-3 flex-1 justify-end">
                <button type="button" onClick={() => setMode("view")} className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={isLoading} className="px-5 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#162d4a] transition-colors disabled:opacity-50">
                  {isLoading ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
