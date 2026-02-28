"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDate, cn } from "@/lib/utils";

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

const priorityConfig = {
  low: { label: "Baja", className: "text-slate-400" },
  medium: { label: "Media", className: "text-amber-500" },
  high: { label: "Alta", className: "text-red-500" },
};

export function ProjectsList({
  projects,
}: {
  projects: ProjectWithClient[];
}) {
  const [filter, setFilter] = useState<string>("all");

  const filtered =
    filter === "all"
      ? projects
      : projects.filter((p) => p.status === filter);

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { value: "all", label: "Todos" },
          { value: "active", label: "Activos" },
          { value: "planning", label: "Planeación" },
          { value: "paused", label: "Pausados" },
          { value: "completed", label: "Completados" },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
              filter === tab.value
                ? "bg-[#1e3a5f] text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Projects grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-200">
          No hay proyectos en esta categoría
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((project) => {
            const status = statusConfig[project.status];
            const priority = priorityConfig[project.priority];
            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="bg-white rounded-xl border border-slate-200 p-5 hover:border-slate-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-slate-900 line-clamp-1">
                    {project.name}
                  </h3>
                  <span
                    className={cn(
                      "ml-2 text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap",
                      status.className
                    )}
                  >
                    {status.label}
                  </span>
                </div>

                {project.description && (
                  <p className="text-sm text-slate-500 line-clamp-2 mb-3">
                    {project.description}
                  </p>
                )}

                <div className="flex items-center justify-between text-xs text-slate-400 mt-auto pt-3 border-t border-slate-100">
                  <span className={cn("font-medium", priority.className)}>
                    {priority.label}
                  </span>
                  {project.clientName && (
                    <span className="truncate max-w-[120px]">
                      {project.clientName}
                    </span>
                  )}
                  {project.endDate && (
                    <span>{formatDate(project.endDate)}</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
