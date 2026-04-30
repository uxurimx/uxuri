"use client";

import { useState } from "react";
import { cn, formatDate } from "@/lib/utils";
import {
  AlertTriangle, CheckCircle2, Play, LayoutGrid, CalendarClock,
  DollarSign, ChevronDown, ChevronUp, CalendarX,
} from "lucide-react";
import Link from "next/link";

export type UpcomingProject = {
  id: string;
  name: string;
  endDate: string;
  status: string;
  priority: string;
  taskCount: number;
  doneCount: number;
};

export type OverdueProject = {
  id: string;
  name: string;
  endDate: string;
  priority: string;
};

type Props = {
  total: number;
  active: number;
  planning: number;
  completed: number;
  overdue: number;
  upcoming: UpcomingProject[];
  overdueProjects?: OverdueProject[];
  totalActiveBudget?: number;
  noDateCount?: number;
  currency?: string;
  activeFilter?: string;
};

const priorityDot: Record<string, string> = {
  low:    "bg-slate-300",
  medium: "bg-amber-400",
  high:   "bg-orange-500",
};

const statusLabel: Record<string, string> = {
  planning:  "Planeación",
  active:    "Activo",
  paused:    "Pausado",
  completed: "Completado",
  cancelled: "Cancelado",
};

function formatCurrency(amount: number, currency = "MXN") {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function ProjectStats({
  total, active, planning, completed, overdue, upcoming,
  overdueProjects = [],
  totalActiveBudget = 0,
  noDateCount = 0,
  currency = "MXN",
  activeFilter,
}: Props) {
  const [showAllOverdue, setShowAllOverdue] = useState(false);

  const effectiveFilter = activeFilter ?? "active";

  const kpis = [
    {
      label: "Total",
      value: total,
      secondary: noDateCount > 0 ? `${noDateCount} sin fecha` : null,
      icon: <LayoutGrid className="w-4 h-4" />,
      color: "text-slate-600",
      bg: "bg-slate-50",
      href: "/projects?status=all",
      filter: "all",
    },
    {
      label: "Activos",
      value: active,
      secondary: null,
      icon: <Play className="w-4 h-4" />,
      color: "text-emerald-700",
      bg: "bg-emerald-50",
      href: "/projects?status=active",
      filter: "active",
    },
    {
      label: "Planeación",
      value: planning,
      secondary: null,
      icon: <CalendarClock className="w-4 h-4" />,
      color: "text-blue-700",
      bg: "bg-blue-50",
      href: "/projects?status=planning",
      filter: "planning",
    },
    {
      label: "Completados",
      value: completed,
      secondary: null,
      icon: <CheckCircle2 className="w-4 h-4" />,
      color: "text-slate-500",
      bg: "bg-slate-50",
      href: "/projects?status=completed",
      filter: "completed",
    },
    {
      label: "Vencidos",
      value: overdue,
      secondary: null,
      icon: <AlertTriangle className="w-4 h-4" />,
      color: overdue > 0 ? "text-red-600" : "text-slate-400",
      bg: overdue > 0 ? "bg-red-50" : "bg-slate-50",
      href: "/projects?status=overdue",
      filter: "overdue",
    },
  ];

  const visibleOverdue = showAllOverdue ? overdueProjects : overdueProjects.slice(0, 4);

  return (
    <div className="space-y-4">
      {/* KPI row — clickable cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {kpis.map((kpi) => {
          const isActive = effectiveFilter === kpi.filter;
          return (
            <Link
              key={kpi.label}
              href={kpi.href}
              className={cn(
                "rounded-xl border p-4 flex items-center gap-3 transition-all hover:shadow-sm",
                kpi.bg,
                isActive
                  ? "border-[#1e3a5f]/40 ring-2 ring-[#1e3a5f]/15 shadow-sm"
                  : "border-slate-200 hover:border-slate-300"
              )}
            >
              <span className={cn("flex-shrink-0", kpi.color)}>{kpi.icon}</span>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-slate-900 leading-none">{kpi.value}</p>
                <p className={cn("text-xs font-medium mt-0.5", kpi.color)}>{kpi.label}</p>
                {kpi.secondary && (
                  <p className="text-[10px] text-amber-600 mt-0.5 truncate">{kpi.secondary}</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Budget + no-date info row */}
      {(totalActiveBudget > 0 || noDateCount > 0) && (
        <div className="flex items-center flex-wrap gap-4 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5">
          {totalActiveBudget > 0 && (
            <span className="flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
              Presupuesto en activos:
              <strong className="text-slate-700">{formatCurrency(totalActiveBudget, currency)}</strong>
            </span>
          )}
          {noDateCount > 0 && (
            <span className="flex items-center gap-1.5 text-amber-600">
              <CalendarX className="w-3.5 h-3.5" />
              {noDateCount} proyecto{noDateCount !== 1 ? "s" : ""} sin fecha de fin
            </span>
          )}
        </div>
      )}

      {/* Overdue projects list */}
      {overdueProjects.length > 0 && (
        <div className="bg-white rounded-xl border border-red-200 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border-b border-red-100">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-sm font-semibold text-red-800">
              {overdueProjects.length} {overdueProjects.length === 1 ? "proyecto vencido" : "proyectos vencidos"}
            </span>
            <Link
              href="/projects?status=overdue"
              className="ml-auto text-xs text-red-600 hover:underline"
            >
              Ver todos
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {visibleOverdue.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-red-50/50 transition-colors group"
              >
                <span className={cn("w-2 h-2 rounded-full flex-shrink-0", priorityDot[p.priority] ?? "bg-slate-300")} />
                <span className="text-sm text-slate-800 truncate flex-1 group-hover:text-red-700">{p.name}</span>
                <span className="text-xs text-red-500 font-medium whitespace-nowrap">{formatDate(p.endDate)}</span>
              </Link>
            ))}
          </div>
          {overdueProjects.length > 4 && (
            <button
              onClick={() => setShowAllOverdue((v) => !v)}
              className="w-full flex items-center justify-center gap-1 py-2 text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors border-t border-slate-100"
            >
              {showAllOverdue
                ? <><ChevronUp className="w-3 h-3" /> Mostrar menos</>
                : <><ChevronDown className="w-3 h-3" /> {overdueProjects.length - 4} más</>
              }
            </button>
          )}
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border-b border-amber-100">
            <CalendarClock className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-800">Próximos a vencer — 14 días</span>
          </div>
          <div className="divide-y divide-slate-100">
            {upcoming.map((p) => {
              const pct = p.taskCount > 0 ? Math.round((p.doneCount / p.taskCount) * 100) : 0;
              return (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors"
                >
                  <span className={cn("w-2 h-2 rounded-full flex-shrink-0", priorityDot[p.priority] ?? "bg-slate-300")} />
                  <span className="flex-1 text-sm font-medium text-slate-800 truncate">{p.name}</span>
                  <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                    {statusLabel[p.status] ?? p.status}
                  </span>
                  {p.taskCount > 0 && (
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                      {p.doneCount}/{p.taskCount} tareas
                    </span>
                  )}
                  {p.taskCount > 0 && (
                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                      <div
                        className={cn("h-full rounded-full", pct === 100 ? "bg-emerald-400" : "bg-[#1e3a5f]")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                  <span className="text-xs font-medium text-amber-700 whitespace-nowrap">
                    {formatDate(p.endDate)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
