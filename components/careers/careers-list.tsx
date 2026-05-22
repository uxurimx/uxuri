"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Eye, Users, Clock, ExternalLink, MoreHorizontal,
  Globe, Lock, Pencil, Trash2, Copy, ChevronRight, ChevronDown,
} from "lucide-react";

const STATUS_CONFIG = {
  draft:  { label: "Borrador",  className: "bg-slate-100 text-slate-600" },
  open:   { label: "Abierta",   className: "bg-emerald-50 text-emerald-700" },
  paused: { label: "Pausada",   className: "bg-amber-50 text-amber-700" },
  closed: { label: "Cerrada",   className: "bg-red-50 text-red-600" },
} as const;

const EMP_LABELS: Record<string, string> = {
  fixed_salary:   "Sueldo fijo",
  commission:     "Comisión",
  mixed:          "Mixto",
  equity_partner: "Equity",
};

type JobRow = {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "open" | "paused" | "closed";
  employmentType: string | null;
  isPublic: boolean;
  viewCount: number;
  closesAt: Date | null;
  createdAt: Date;
  totalApplications: number;
  newApplications: number;
};

export function CareersList({ jobs: initialJobs }: { jobs: JobRow[] }) {
  const router = useRouter();
  const [jobs, setJobs] = useState(initialJobs);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleStatusChange(id: string, status: JobRow["status"]) {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, status } : j));
    await fetch(`/api/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Borrar esta vacante y todas sus aplicaciones?")) return;
    setDeleting(id);
    await fetch(`/api/jobs/${id}`, { method: "DELETE" });
    router.refresh();
    setDeleting(null);
  }

  function copyLink(slug: string) {
    const url = `${window.location.origin}/jobs/${slug}`;
    navigator.clipboard.writeText(url);
    setMenuOpen(null);
  }

  if (jobs.length === 0) {
    return (
      <div className="bg-[var(--skin-card-bg,#fff)] rounded-2xl border border-[var(--skin-border,#e2e8f0)] p-16 text-center">
        <p className="text-[var(--skin-text-muted,#64748b)] text-lg mb-2">Sin vacantes aún</p>
        <p className="text-[var(--skin-text-muted,#64748b)] text-sm">
          Crea tu primera vacante y comparte el link en tus redes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => {
        const statusCfg = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.draft;
        const isMenuOpen = menuOpen === job.id;

        return (
          <div
            key={job.id}
            className="bg-[var(--skin-card-bg,#fff)] rounded-2xl border border-[var(--skin-border,#e2e8f0)] p-5 hover:border-[#1e3a5f]/30 transition-colors"
          >
            <div className="flex items-start gap-4">
              {/* Main info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  {/* Status dropdown inline */}
                  <div className="relative">
                    <select
                      value={job.status}
                      onChange={e => handleStatusChange(job.id, e.target.value as JobRow["status"])}
                      onClick={e => e.stopPropagation()}
                      className={`appearance-none pl-2.5 pr-6 py-0.5 rounded-full text-xs font-semibold border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] ${statusCfg.className}`}
                    >
                      <option value="draft">Borrador</option>
                      <option value="open">Abierta</option>
                      <option value="paused">Pausada</option>
                      <option value="closed">Cerrada</option>
                    </select>
                    <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                  </div>
                  {job.employmentType && (
                    <span className="text-xs text-[var(--skin-text-muted,#64748b)] bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200">
                      {EMP_LABELS[job.employmentType] ?? job.employmentType}
                    </span>
                  )}
                  {job.isPublic ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                      <Globe className="w-3 h-3" /> Pública
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                      <Lock className="w-3 h-3" /> Privada
                    </span>
                  )}
                </div>

                <Link href={`/careers/${job.id}`} className="group">
                  <h3 className="text-base font-bold text-[var(--skin-text,#0f172a)] group-hover:text-[#1e3a5f] transition-colors truncate">
                    {job.title}
                    <ChevronRight className="w-4 h-4 inline ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h3>
                </Link>

                <div className="flex items-center gap-4 mt-2 text-sm text-[var(--skin-text-muted,#64748b)]">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    {job.totalApplications} aplicaciones
                    {job.newApplications > 0 && (
                      <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#1e3a5f] text-white text-xs font-bold">
                        {job.newApplications}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" />
                    {job.viewCount} vistas
                  </span>
                  {job.closesAt && (
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      Cierra {new Date(job.closesAt).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {job.status === "open" && (
                  <a
                    href={`/jobs/${job.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg text-[var(--skin-text-muted,#64748b)] hover:bg-slate-100 hover:text-[#1e3a5f] transition-colors"
                    title="Ver landing pública"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}

                <div className="relative">
                  <button
                    onClick={() => setMenuOpen(isMenuOpen ? null : job.id)}
                    className="p-2 rounded-lg text-[var(--skin-text-muted,#64748b)] hover:bg-slate-100 transition-colors"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>

                  {isMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                      <div className="absolute right-0 top-9 z-20 w-44 bg-white rounded-xl border border-slate-200 shadow-lg py-1 overflow-hidden">
                        <Link
                          href={`/careers/${job.id}`}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                          onClick={() => setMenuOpen(null)}
                        >
                          <Users className="w-4 h-4" /> Ver candidatos
                        </Link>
                        <button
                          onClick={() => copyLink(job.slug)}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                        >
                          <Copy className="w-4 h-4" /> Copiar link
                        </button>
                        <Link
                          href={`/careers/${job.id}/edit`}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                          onClick={() => setMenuOpen(null)}
                        >
                          <Pencil className="w-4 h-4" /> Editar
                        </Link>
                        <div className="border-t border-slate-100 mt-1 pt-1">
                          <button
                            onClick={() => handleDelete(job.id)}
                            disabled={deleting === job.id}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" /> Eliminar
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
