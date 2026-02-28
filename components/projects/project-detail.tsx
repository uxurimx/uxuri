"use client";

import Link from "next/link";
import { cn, formatDate } from "@/lib/utils";
import { ArrowLeft, Calendar, User, Flag } from "lucide-react";
import { KanbanBoard, type TaskWithProject } from "@/components/tasks/kanban-board";

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
  planning:  { label: "Planeación", className: "bg-slate-100 text-slate-600" },
  active:    { label: "Activo",     className: "bg-emerald-50 text-emerald-700" },
  paused:    { label: "Pausado",    className: "bg-amber-50 text-amber-700" },
  completed: { label: "Completado", className: "bg-blue-50 text-blue-700" },
  cancelled: { label: "Cancelado",  className: "bg-red-50 text-red-700" },
};

export function ProjectDetail({
  project,
  tasks,
}: {
  project: ProjectWithClient;
  tasks: TaskWithProject[];
}) {
  const status = statusConfig[project.status];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/projects" className="text-slate-400 hover:text-slate-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", status.className)}>
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
              <span>
                {formatDate(project.startDate)} → {project.endDate ? formatDate(project.endDate) : "Sin fecha"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Kanban de tareas del proyecto */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-slate-900">
            Tareas <span className="text-slate-400 font-normal text-sm">({tasks.length})</span>
          </h2>
        </div>
        <KanbanBoard
          initialTasks={tasks}
          projectId={project.id}
          showProjectName={false}
        />
      </div>
    </div>
  );
}
