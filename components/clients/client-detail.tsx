import Link from "next/link";
import type { Client, Project } from "@/db/schema";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Building2, Mail, Phone, FileText, ArrowLeft } from "lucide-react";

const statusConfig = {
  active: { label: "Activo", className: "bg-emerald-50 text-emerald-700" },
  inactive: { label: "Inactivo", className: "bg-slate-100 text-slate-600" },
  prospect: { label: "Prospecto", className: "bg-amber-50 text-amber-700" },
};

const projectStatusConfig = {
  planning: { label: "Planeación", className: "bg-slate-100 text-slate-600" },
  active: { label: "Activo", className: "bg-emerald-50 text-emerald-700" },
  paused: { label: "Pausado", className: "bg-amber-50 text-amber-700" },
  completed: { label: "Completado", className: "bg-blue-50 text-blue-700" },
  cancelled: { label: "Cancelado", className: "bg-red-50 text-red-700" },
};

interface ClientDetailProps {
  client: Client;
  projects: Project[];
}

export function ClientDetail({ client, projects }: ClientDetailProps) {
  const status = statusConfig[client.status];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/clients"
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{client.name}</h1>
          <span
            className={cn(
              "inline-flex px-2 py-0.5 rounded-full text-xs font-medium mt-1",
              status.className
            )}
          >
            {status.label}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client info */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-semibold text-slate-900">Información</h2>

          {client.company && (
            <div className="flex items-start gap-3">
              <Building2 className="w-4 h-4 text-slate-400 mt-0.5" />
              <span className="text-sm text-slate-600">{client.company}</span>
            </div>
          )}
          {client.email && (
            <div className="flex items-start gap-3">
              <Mail className="w-4 h-4 text-slate-400 mt-0.5" />
              <span className="text-sm text-slate-600">{client.email}</span>
            </div>
          )}
          {client.phone && (
            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 text-slate-400 mt-0.5" />
              <span className="text-sm text-slate-600">{client.phone}</span>
            </div>
          )}
          {client.notes && (
            <div className="flex items-start gap-3">
              <FileText className="w-4 h-4 text-slate-400 mt-0.5" />
              <span className="text-sm text-slate-600">{client.notes}</span>
            </div>
          )}

          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-400">
              Cliente desde {formatDate(client.createdAt)}
            </p>
          </div>
        </div>

        {/* Projects */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">
              Proyectos ({projects.length})
            </h2>
            <Link
              href={`/projects/new`}
              className="text-sm text-[#1e3a5f] hover:underline"
            >
              + Nuevo proyecto
            </Link>
          </div>

          {projects.length === 0 ? (
            <p className="text-slate-400 text-sm">
              No hay proyectos asociados a este cliente
            </p>
          ) : (
            <div className="space-y-3">
              {projects.map((project) => {
                const pStatus =
                  projectStatusConfig[project.status];
                return (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {project.name}
                      </p>
                      {project.description && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                          {project.description}
                        </p>
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        pStatus.className
                      )}
                    >
                      {pStatus.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
