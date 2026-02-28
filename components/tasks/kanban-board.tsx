"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn, formatDate } from "@/lib/utils";
import { Flag, Pencil, Trash2, Plus } from "lucide-react";
import { TaskModal, type TaskForModal } from "./task-modal";

export type TaskWithProject = {
  id: string;
  title: string;
  description: string | null;
  projectId: string | null;
  clientId: string | null;
  assignedTo: string | null;
  status: "todo" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: string | null;
  createdAt: Date;
  projectName: string | null;
};

const columns = [
  { id: "todo" as const,        label: "Por hacer",   color: "bg-slate-100",  headerColor: "text-slate-600" },
  { id: "in_progress" as const, label: "En progreso", color: "bg-blue-50",    headerColor: "text-blue-700" },
  { id: "review" as const,      label: "Revisión",    color: "bg-purple-50",  headerColor: "text-purple-700" },
  { id: "done" as const,        label: "Hecho",       color: "bg-emerald-50", headerColor: "text-emerald-700" },
];

const priorityConfig = {
  low:    { label: "Baja",    color: "text-slate-400" },
  medium: { label: "Media",   color: "text-amber-500" },
  high:   { label: "Alta",    color: "text-orange-500" },
  urgent: { label: "Urgente", color: "text-red-500" },
};

interface KanbanBoardProps {
  initialTasks: TaskWithProject[];
  projectId?: string;       // cuando se pasa, muestra botón "Nueva tarea" en el header del board
  showProjectName?: boolean; // mostrar el nombre del proyecto en la tarjeta (default: true)
}

export function KanbanBoard({ initialTasks, projectId, showProjectName = true }: KanbanBoardProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskForModal | null>(null);

  useEffect(() => { setTasks(initialTasks); }, [initialTasks]);

  function openCreate() {
    setEditingTask(null);
    setModalOpen(true);
  }

  function openEdit(task: TaskWithProject) {
    setEditingTask(task);
    setModalOpen(true);
  }

  async function handleDelete(taskId: string) {
    if (!confirm("¿Eliminar esta tarea?")) return;
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    router.refresh();
  }

  function handleModalClose() {
    setModalOpen(false);
    setEditingTask(null);
    router.refresh();
  }

  const getColumnTasks = (status: TaskWithProject["status"]) =>
    tasks.filter((t) => t.status === status);

  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("taskId", taskId);
    setDraggingId(taskId);
  }, []);

  const handleDragEnd = useCallback(() => { setDraggingId(null); }, []);
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetStatus: TaskWithProject["status"]) => {
      e.preventDefault();
      const taskId = e.dataTransfer.getData("taskId");
      if (!taskId) return;
      const task = tasks.find((t) => t.id === taskId);
      if (!task || task.status === targetStatus) return;

      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: targetStatus } : t));
      try {
        await fetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: targetStatus }),
        });
        router.refresh();
      } catch {
        setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: task.status } : t));
      }
    },
    [tasks, router]
  );

  return (
    <>
      {projectId && (
        <div className="flex justify-end mb-4">
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#162d4a] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nueva tarea
          </button>
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => {
          const colTasks = getColumnTasks(col.id);
          return (
            <div
              key={col.id}
              className="flex-shrink-0 w-72"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              {/* Column header */}
              <div className={cn("flex items-center justify-between px-3 py-2 rounded-xl mb-3", col.color)}>
                <span className={cn("text-sm font-semibold", col.headerColor)}>{col.label}</span>
                <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded-full bg-white/60", col.headerColor)}>
                  {colTasks.length}
                </span>
              </div>

              {/* Tasks */}
              <div className="space-y-3 min-h-[120px]">
                {colTasks.map((task) => {
                  const priority = priorityConfig[task.priority];
                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "group bg-white rounded-xl border border-slate-200 p-3 cursor-grab active:cursor-grabbing hover:shadow-sm transition-all",
                        draggingId === task.id && "opacity-50 shadow-lg"
                      )}
                    >
                      {/* Actions — visible on hover */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-sm font-medium text-slate-900 leading-snug flex-1">
                          {task.title}
                        </p>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); openEdit(task); }}
                            className="p-1 rounded-md text-slate-400 hover:text-[#1e3a5f] hover:bg-slate-100 transition-colors"
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); handleDelete(task.id); }}
                            className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {task.description && (
                        <p className="text-xs text-slate-500 mb-2 line-clamp-2">{task.description}</p>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Flag className={cn("w-3 h-3", priority.color)} />
                          <span className={cn("text-xs font-medium", priority.color)}>{priority.label}</span>
                        </div>
                        {task.dueDate && (
                          <span className="text-xs text-slate-400">{formatDate(task.dueDate)}</span>
                        )}
                      </div>

                      {showProjectName && task.projectName && (
                        <div className="mt-2 pt-2 border-t border-slate-100">
                          <span className="text-xs text-slate-400 truncate block">{task.projectName}</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {colTasks.length === 0 && (
                  <div className="rounded-xl border-2 border-dashed border-slate-200 h-24 flex items-center justify-center">
                    <p className="text-xs text-slate-300">Arrastra tareas aquí</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <TaskModal
        open={modalOpen}
        onClose={handleModalClose}
        projectId={projectId}
        task={editingTask}
      />
    </>
  );
}
