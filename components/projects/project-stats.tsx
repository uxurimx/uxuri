import { cn, formatDate } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Play, LayoutGrid, CalendarClock } from "lucide-react";
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

type Props = {
  total: number;
  active: number;
  planning: number;
  completed: number;
  overdue: number;
  upcoming: UpcomingProject[];
};

const priorityDot: Record<string, string> = {
  low: "bg-slate-300",
  medium: "bg-amber-400",
  high: "bg-orange-500",
};

const statusLabel: Record<string, string> = {
  planning: "Planeación",
  active: "Activo",
  paused: "Pausado",
  completed: "Completado",
  cancelled: "Cancelado",
};

export function ProjectStats({ total, active, planning, completed, overdue, upcoming }: Props) {
  const kpis = [
    {
      label: "Total",
      value: total,
      icon: <LayoutGrid className="w-4 h-4" />,
      color: "text-slate-600",
      bg: "bg-slate-50",
    },
    {
      label: "Activos",
      value: active,
      icon: <Play className="w-4 h-4" />,
      color: "text-emerald-700",
      bg: "bg-emerald-50",
    },
    {
      label: "Planeación",
      value: planning,
      icon: <CalendarClock className="w-4 h-4" />,
      color: "text-blue-700",
      bg: "bg-blue-50",
    },
    {
      label: "Completados",
      value: completed,
      icon: <CheckCircle2 className="w-4 h-4" />,
      color: "text-slate-500",
      bg: "bg-slate-50",
    },
    {
      label: "Vencidos",
      value: overdue,
      icon: <AlertTriangle className="w-4 h-4" />,
      color: overdue > 0 ? "text-red-600" : "text-slate-400",
      bg: overdue > 0 ? "bg-red-50" : "bg-slate-50",
    },
  ];

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className={cn("rounded-xl border border-slate-200 p-4 flex items-center gap-3", kpi.bg)}
          >
            <span className={cn("flex-shrink-0", kpi.color)}>{kpi.icon}</span>
            <div>
              <p className="text-2xl font-bold text-slate-900 leading-none">{kpi.value}</p>
              <p className={cn("text-xs font-medium mt-0.5", kpi.color)}>{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

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
