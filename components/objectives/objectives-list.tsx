"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Target, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ObjectiveCard {
  id: string;
  title: string;
  description: string | null;
  status: "draft" | "active" | "paused" | "completed" | "cancelled";
  priority: string;
  targetDate: string | null;
  milestoneCount: number | string;
  projectCount: number | string;
  taskCount: number | string;
}

const statusConfig = {
  draft:     { label: "Borrador",   className: "bg-slate-100 text-slate-600" },
  active:    { label: "Activo",     className: "bg-emerald-50 text-emerald-700" },
  paused:    { label: "Pausado",    className: "bg-amber-50 text-amber-700" },
  completed: { label: "Completado", className: "bg-blue-50 text-blue-700" },
  cancelled: { label: "Cancelado",  className: "bg-red-50 text-red-700" },
};

const priorityConfig = {
  low:    { label: "Baja",    color: "text-slate-400" },
  medium: { label: "Media",   color: "text-amber-500" },
  high:   { label: "Alta",    color: "text-orange-500" },
  urgent: { label: "Urgente", color: "text-red-500" },
};

interface ObjectivesListProps {
  initialObjectives: ObjectiveCard[];
}

export function ObjectivesList({ initialObjectives }: ObjectivesListProps) {
  const router = useRouter();
  const [objectives, setObjectives] = useState<ObjectiveCard[]>(initialObjectives);
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ObjectiveCard["status"]>("active");
  const [priority, setPriority] = useState("medium");
  const [targetDate, setTargetDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/objectives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          status,
          priority,
          targetDate: targetDate || null,
        }),
      });
      if (res.ok) {
        const obj = await res.json();
        setObjectives((prev) => [
          ...prev,
          { ...obj, milestoneCount: 0, projectCount: 0, taskCount: 0 },
        ]);
        setShowModal(false);
        setTitle("");
        setDescription("");
        setStatus("active");
        setPriority("medium");
        setTargetDate("");
        router.push(`/objectives/${obj.id}`);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#1e3a5f]/10 flex items-center justify-center">
            <Target className="w-5 h-5 text-[#1e3a5f]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Objetivos</h1>
            <p className="text-sm text-slate-500">{objectives.length} objetivo(s)</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#162d4a] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo objetivo
        </button>
      </div>

      {/* Grid */}
      {objectives.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay objetivos todavía.</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-3 text-[#1e3a5f] text-sm hover:underline"
          >
            Crea el primero →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {objectives.map((obj) => {
            const sc = statusConfig[obj.status];
            const pc = priorityConfig[obj.priority as keyof typeof priorityConfig] ?? priorityConfig.medium;
            return (
              <Link
                key={obj.id}
                href={`/objectives/${obj.id}`}
                className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 hover:shadow-sm transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-slate-900 line-clamp-2">{obj.title}</h3>
                  <span
                    className={cn(
                      "flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium",
                      sc.className
                    )}
                  >
                    {sc.label}
                  </span>
                </div>

                {obj.description && (
                  <p className="text-sm text-slate-500 line-clamp-2">{obj.description}</p>
                )}

                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className={cn("font-medium", pc.color)}>{pc.label}</span>
                  {obj.targetDate && (
                    <span>
                      Meta: {new Date(obj.targetDate).toLocaleDateString("es-MX")}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-400 pt-1 border-t border-slate-100">
                  <span>{Number(obj.milestoneCount)} hitos</span>
                  <span>{Number(obj.projectCount)} proyectos</span>
                  <span>{Number(obj.taskCount)} tareas</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Nuevo objetivo</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Título *</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                  placeholder="Ej. Aumentar retención de clientes 20%"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 resize-none"
                  placeholder="Contexto y detalles..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ObjectiveCard["status"])}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                  >
                    <option value="draft">Borrador</option>
                    <option value="active">Activo</option>
                    <option value="paused">Pausado</option>
                    <option value="completed">Completado</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Prioridad</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                  >
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha meta</label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !title.trim()}
                  className="flex-1 px-4 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#162d4a] transition-colors disabled:opacity-50"
                >
                  {saving ? "Creando..." : "Crear objetivo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
