"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn, formatDate } from "@/lib/utils";
import type { Task } from "@/db/schema";
import { ArrowLeft, Calendar, User, Flag, Plus } from "lucide-react";
import { TaskCreateModal } from "@/components/tasks/task-create-modal";

type ProjectWithClient = {
  id: string;
  name: string;
  description: string | null;
  clientId: string | null;
  status: "planning" | "active" | "paused" | "completed" | "cancelled";
  priority: "low" | "medium" | "high";
  startDate: string | null;
  endDate: string | null;
  createdAt: Date;
  clientName: string | null;
};

const statusConfig = {
  planning: { label: "Planeación", className: "bg-slate-100 text-slate-600" },
  active: { label: "Activo", className: "bg-emerald-50 text-emerald-700" },
  paused: { label: "Pausado", className: "bg-amber-50 text-amber-700" },
  completed: { label: "Completado", className: "bg-blue-50 text-blue-700" },
  cancelled: { label: "Cancelado", className: "bg-red-50 text-red-700" },
};

const taskStatusConfig = {
  todo: { label: "Por hacer", className: "bg-slate-100 text-slate-600" },
  in_progress: { label: "En progreso", className: "bg-blue-50 text-blue-700" },
  review: { label: "Revisión", className: "bg-purple-50 text-purple-700" },
  done: { label: "Hecho", className: "bg-emerald-50 text-emerald-700" },
};

const priorityConfig = {
  low: { label: "Baja", className: "text-slate-400" },
  medium: { label: "Media", className: "text-amber-500" },
  high: { label: "Alta", className: "text-orange-500" },
  urgent: { label: "Urgente", className: "text-red-500" },
};

export function ProjectDetail({
  project,
  tasks,
}: {
  project: ProjectWithClient;
  tasks: Task[];
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);

  const status = statusConfig[project.status];

  const tasksByStatus = {
    todo: tasks.filter((t) => t.status === "todo"),
    in_progress: tasks.filter((t) => t.status === "in_progress"),
    review: tasks.filter((t) => t.status === "review"),
    done: tasks.filter((t) => t.status === "done"),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/projects"
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
            <span
              className={cn(
                "text-xs px-2 py-0.5 rounded-full font-medium",
                status.className
              )}
            >
              {status.label}
            </span>
          </div>
          {project.description && (
            <p className="text-slate-500 text-sm mt-1">{project.description}</p>
          )}
        </div>
      </div>

      {/* Project meta */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex flex-wrap gap-6">
          {project.clientName && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <User className="w-4 h-4 text-slate-400" />
              <span>{project.clientName}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Flag className="w-4 h-4 text-slate-400" />
            <span className="capitalize">{project.priority}</span>
          </div>
          {project.startDate && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span>{formatDate(project.startDate)} → {project.endDate ? formatDate(project.endDate) : "Sin fecha"}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tasks by status */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900">
            Tareas ({tasks.length})
          </h2>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#162d4a] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nueva tarea
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(["todo", "in_progress", "review", "done"] as const).map(
            (statusKey) => {
              const statusInfo = taskStatusConfig[statusKey];
              const statusTasks = tasksByStatus[statusKey];
              return (
                <div
                  key={statusKey}
                  className="bg-white rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        statusInfo.className
                      )}
                    >
                      {statusInfo.label}
                    </span>
                    <span className="text-xs text-slate-400">
                      {statusTasks.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {statusTasks.map((task) => (
                      <div
                        key={task.id}
                        className="p-2 bg-slate-50 rounded-lg"
                      >
                        <p className="text-xs font-medium text-slate-700">
                          {task.title}
                        </p>
                        {task.priority && (
                          <span
                            className={cn(
                              "text-[10px] font-medium",
                              priorityConfig[task.priority].className
                            )}
                          >
                            {priorityConfig[task.priority].label}
                          </span>
                        )}
                      </div>
                    ))}
                    {statusTasks.length === 0 && (
                      <p className="text-xs text-slate-300">Sin tareas</p>
                    )}
                  </div>
                </div>
              );
            }
          )}
        </div>
      </div>

      <TaskCreateModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          router.refresh();
        }}
        projectId={project.id}
      />
    </div>
  );
}
