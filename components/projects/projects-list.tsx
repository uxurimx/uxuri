"use client";

import { useState } from "react";
import { formatDate, cn } from "@/lib/utils";
import { Pencil, Trash2, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { ProjectModal, type ProjectForModal } from "./project-modal";

type Client = { id: string; name: string };

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

export function ProjectsList({
  projects,
  clients,
}: {
  projects: ProjectForModal[];
  clients: Client[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<string>("all");
  const [selectedProject, setSelectedProject] = useState<ProjectForModal | null>(null);
  const [modalInitialMode, setModalInitialMode] = useState<"view" | "edit">("view");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = filter === "all" ? projects : projects.filter((p) => p.status === filter);

  function openView(project: ProjectForModal) {
    setSelectedProject(project);
    setModalInitialMode("view");
  }

  function openEdit(e: React.MouseEvent, project: ProjectForModal) {
    e.stopPropagation();
    setSelectedProject(project);
    setModalInitialMode("edit");
  }

  async function handleDelete(e: React.MouseEvent, project: ProjectForModal) {
    e.stopPropagation();
    if (!confirm(`¿Eliminar "${project.name}"? Las tareas asociadas quedarán sin proyecto.`)) return;
    setDeletingId(project.id);
    try {
      await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <div className="space-y-4">
        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            { value: "all",       label: "Todos" },
            { value: "active",    label: "Activos" },
            { value: "planning",  label: "Planeación" },
            { value: "paused",    label: "Pausados" },
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
                <div
                  key={project.id}
                  onClick={() => openView(project)}
                  className="group relative bg-white rounded-xl border border-slate-200 p-5 hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer"
                >
                  {/* Hover actions */}
                  <div className="absolute top-3 right-3 hidden group-hover:flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); router.push(`/projects/${project.id}`); }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-[#1e3a5f] hover:bg-slate-100 transition-colors"
                      title="Ir al proyecto"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => openEdit(e, project)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-[#1e3a5f] hover:bg-slate-100 transition-colors"
                      title="Editar"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, project)}
                      disabled={deletingId === project.id}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-start justify-between mb-3 pr-20">
                    <h3 className="font-semibold text-slate-900 line-clamp-1">{project.name}</h3>
                    <span className={cn("ml-2 text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap flex-shrink-0", status.className)}>
                      {status.label}
                    </span>
                  </div>

                  {project.description && (
                    <p className="text-sm text-slate-500 line-clamp-2 mb-3">{project.description}</p>
                  )}

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-100">
                    <span className={cn("font-medium", priority.className)}>{priority.label}</span>
                    {project.clientName && (
                      <span className="truncate max-w-[120px]">{project.clientName}</span>
                    )}
                    {project.endDate && <span>{formatDate(project.endDate)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedProject && (
        <ProjectModal
          open={!!selectedProject}
          onClose={() => setSelectedProject(null)}
          project={selectedProject}
          clients={clients}
          initialMode={modalInitialMode}
        />
      )}
    </>
  );
}
