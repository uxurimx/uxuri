"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, ArrowRight, MoveRight, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Project = {
  id: string;
  name: string;
  taskCount: number;
};

interface Props {
  open: boolean;
  onClose: () => void;
  sourceId: string;
  projects: Project[];
}

export function ProjectMergeModal({ open, onClose, sourceId, projects }: Props) {
  const router = useRouter();
  const [targetId, setTargetId] = useState("");
  const [deleteSource, setDeleteSource] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const source = projects.find((p) => p.id === sourceId);
  const target = projects.find((p) => p.id === targetId);
  const others = projects.filter((p) => p.id !== sourceId);

  async function handleConfirm() {
    if (!targetId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/projects/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId, targetId, deleteSource }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error al mover tareas");
        return;
      }
      onClose();
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setTargetId("");
    setDeleteSource(false);
    setError("");
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <MoveRight className="w-4 h-4 text-slate-500" />
            <h2 className="text-base font-semibold text-slate-900">Mover tareas / Unificar proyecto</h2>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* From → To visual */}
          <div className="flex items-center gap-3">
            <div className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-xs text-slate-400 mb-0.5">Desde</p>
              <p className="text-sm font-semibold text-slate-800 truncate">{source?.name ?? "—"}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {source?.taskCount ?? 0} {(source?.taskCount ?? 0) === 1 ? "tarea" : "tareas"}
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
            <div className="flex-1 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-400 mb-0.5">Hacia</p>
              {target ? (
                <>
                  <p className="text-sm font-semibold text-blue-800 truncate">{target.name}</p>
                  <p className="text-xs text-blue-500 mt-0.5">
                    {target.taskCount} {target.taskCount === 1 ? "tarea" : "tareas"} actuales
                  </p>
                </>
              ) : (
                <p className="text-sm text-blue-400 italic">Selecciona destino</p>
              )}
            </div>
          </div>

          {/* Target selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Proyecto destino
            </label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
            >
              <option value="">Selecciona proyecto...</option>
              {others.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.taskCount} tareas)
                </option>
              ))}
            </select>
          </div>

          {/* Preview */}
          {target && source && (
            <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              Se moverán <strong>{source.taskCount}</strong> tarea{source.taskCount !== 1 ? "s" : ""} de{" "}
              <strong>{source.name}</strong> a <strong>{target.name}</strong>.
            </div>
          )}

          {/* Delete source option */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={deleteSource}
              onChange={(e) => setDeleteSource(e.target.checked)}
              className="mt-0.5 accent-red-600"
            />
            <span className="text-sm text-slate-700">
              <span className="font-medium text-red-600 flex items-center gap-1">
                <Trash2 className="w-3.5 h-3.5 inline" />
                Eliminar proyecto origen
              </span>
              <span className="block text-xs text-slate-400 mt-0.5">
                Se eliminará <strong>{source?.name}</strong> después de mover las tareas.
              </span>
            </span>
          </label>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!targetId || loading}
              className={cn(
                "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                deleteSource
                  ? "bg-red-600 text-white hover:bg-red-700 disabled:opacity-40"
                  : "bg-[#1e3a5f] text-white hover:bg-[#162d4a] disabled:opacity-40"
              )}
            >
              {loading ? "Moviendo..." : deleteSource ? "Mover y eliminar" : "Mover tareas"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
