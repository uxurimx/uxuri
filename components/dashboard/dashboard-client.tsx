"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  CheckCircle2, Clock, AlertTriangle, Calendar, Folder,
  Bot, Settings, X, ChevronRight, Flag, Eye, EyeOff,
} from "lucide-react";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

type PendingTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  projectId: string | null;
  projectName: string | null;
  assignedTo: string | null;
  createdBy: string | null;
};

type ActiveProject = {
  id: string;
  name: string;
  priority: string;
  totalTasks: number;
  doneTasks: number;
};

type CompletedTask = {
  taskId: string | null;
  taskTitle: string | null;
  taskPriority: string | null;
  completedBy: string | null;
  completedAt: Date;
};

type AgentRow = {
  agentName: string | null;
  agentAvatar: string | null;
  agentColor: string | null;
  tasksWorked: number;
  totalSeconds: number;
  sessionsToday: number;
};

// ── Widget system ──────────────────────────────────────────────────────────

type WidgetId = "my-tasks" | "urgent" | "overdue" | "completed-today" | "projects" | "agents";

const WIDGET_META: Record<WidgetId, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  "my-tasks":       { label: "Mis tareas pendientes",    icon: Clock },
  "urgent":         { label: "Urgentes / Alta prioridad", icon: AlertTriangle },
  "overdue":        { label: "Vencidas",                 icon: Calendar },
  "completed-today":{ label: "Completadas hoy",          icon: CheckCircle2 },
  "projects":       { label: "Proyectos activos",        icon: Folder },
  "agents":         { label: "Actividad de agentes",     icon: Bot },
};

const DEFAULT_WIDGETS: WidgetId[] = ["my-tasks", "urgent", "overdue", "completed-today", "projects", "agents"];

function loadWidgets(userId: string): WidgetId[] {
  if (typeof window === "undefined") return DEFAULT_WIDGETS;
  try {
    const raw = localStorage.getItem(`uxuri:dash:${userId}`);
    return raw ? JSON.parse(raw) : DEFAULT_WIDGETS;
  } catch {
    return DEFAULT_WIDGETS;
  }
}

// ── Shared sub-components ──────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  urgent: { label: "Urgente", color: "text-red-600",    dot: "bg-red-500" },
  high:   { label: "Alta",    color: "text-orange-500", dot: "bg-orange-500" },
  medium: { label: "Media",   color: "text-amber-500",  dot: "bg-amber-400" },
  low:    { label: "Baja",    color: "text-slate-400",  dot: "bg-slate-300" },
};

function PriorityDot({ priority }: { priority: string }) {
  const cfg = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.medium;
  return <span className={cn("w-2 h-2 rounded-full flex-shrink-0", cfg.dot)} title={cfg.label} />;
}

function EmptyState({ label }: { label: string }) {
  return (
    <p className="text-sm text-slate-400 text-center py-6">{label}</p>
  );
}

function WidgetShell({ id, label, icon: Icon, count, children }: {
  id: WidgetId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-slate-400" />
          <h3 className="font-semibold text-slate-800 text-sm">{label}</h3>
          {count !== undefined && count > 0 && (
            <span className="text-xs font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">{count}</span>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

// ── Widgets ────────────────────────────────────────────────────────────────

function MyTasksWidget({ tasks }: { tasks: PendingTask[] }) {
  const pending = tasks.filter((t) => t.status !== "done");
  return (
    <WidgetShell id="my-tasks" label="Mis tareas pendientes" icon={Clock} count={pending.length}>
      {pending.length === 0 ? (
        <EmptyState label="Sin tareas pendientes 🎉" />
      ) : (
        <ul className="space-y-2">
          {pending.slice(0, 8).map((t) => (
            <li key={t.id} className="flex items-center gap-2.5 group">
              <PriorityDot priority={t.priority} />
              <Link
                href="/tasks"
                className="flex-1 text-sm text-slate-700 truncate hover:text-[#1e3a5f] transition-colors"
              >
                {t.title}
              </Link>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {t.dueDate && (
                  <span className={cn(
                    "text-[10px] tabular-nums",
                    new Date(t.dueDate) < new Date() ? "text-red-500 font-medium" : "text-slate-400"
                  )}>
                    {formatDate(t.dueDate)}
                  </span>
                )}
                {t.projectName && (
                  <span className="text-[10px] text-slate-400 max-w-[70px] truncate hidden sm:block">
                    {t.projectName}
                  </span>
                )}
              </div>
            </li>
          ))}
          {pending.length > 8 && (
            <li>
              <Link href="/tasks" className="text-xs text-[#1e3a5f] hover:underline">
                + {pending.length - 8} más →
              </Link>
            </li>
          )}
        </ul>
      )}
    </WidgetShell>
  );
}

function UrgentWidget({ tasks }: { tasks: PendingTask[] }) {
  const urgent = tasks.filter((t) => t.priority === "urgent" || t.priority === "high");
  return (
    <WidgetShell id="urgent" label="Urgentes / Alta prioridad" icon={AlertTriangle} count={urgent.length}>
      {urgent.length === 0 ? (
        <EmptyState label="Sin tareas urgentes" />
      ) : (
        <ul className="space-y-2">
          {urgent.slice(0, 8).map((t) => {
            const cfg = PRIORITY_CONFIG[t.priority];
            return (
              <li key={t.id} className="flex items-center gap-2.5">
                <PriorityDot priority={t.priority} />
                <Link href="/tasks" className="flex-1 text-sm text-slate-700 truncate hover:text-[#1e3a5f] transition-colors">
                  {t.title}
                </Link>
                <span className={cn("text-[10px] font-semibold flex-shrink-0", cfg.color)}>
                  {cfg.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetShell>
  );
}

function OverdueWidget({ tasks, todayStr }: { tasks: PendingTask[]; todayStr: string }) {
  const overdue = tasks.filter(
    (t) => t.dueDate && t.dueDate < todayStr && t.status !== "done"
  );
  return (
    <WidgetShell id="overdue" label="Vencidas" icon={Calendar} count={overdue.length}>
      {overdue.length === 0 ? (
        <EmptyState label="Sin tareas vencidas ✓" />
      ) : (
        <ul className="space-y-2">
          {overdue.slice(0, 8).map((t) => {
            const diff = Math.floor((Date.now() - new Date(t.dueDate!).getTime()) / 86_400_000);
            return (
              <li key={t.id} className="flex items-center gap-2.5">
                <PriorityDot priority={t.priority} />
                <Link href="/tasks" className="flex-1 text-sm text-slate-700 truncate hover:text-[#1e3a5f] transition-colors">
                  {t.title}
                </Link>
                <span className="text-[10px] text-red-500 font-semibold flex-shrink-0">
                  {diff === 1 ? "ayer" : `${diff}d`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetShell>
  );
}

function CompletedTodayWidget({
  completedToday,
  doneTodayByMe,
  doneTodayByAgents,
}: {
  completedToday: CompletedTask[];
  doneTodayByMe: number;
  doneTodayByAgents: number;
}) {
  const total = completedToday.length;
  return (
    <WidgetShell id="completed-today" label="Completadas hoy" icon={CheckCircle2} count={total}>
      {/* Mini KPI bar */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 bg-emerald-50 rounded-xl px-3 py-2 text-center">
          <p className="text-2xl font-bold text-emerald-600">{doneTodayByMe}</p>
          <p className="text-[10px] text-emerald-500 font-medium">por mí</p>
        </div>
        <div className="flex-1 bg-violet-50 rounded-xl px-3 py-2 text-center">
          <p className="text-2xl font-bold text-violet-600">{doneTodayByAgents}</p>
          <p className="text-[10px] text-violet-500 font-medium">por agentes</p>
        </div>
      </div>

      {total === 0 ? (
        <EmptyState label="Ninguna tarea completada todavía" />
      ) : (
        <ul className="space-y-2">
          {completedToday.slice(0, 6).map((t, i) => (
            <li key={`${t.taskId}-${i}`} className="flex items-center gap-2.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              <span className="flex-1 text-sm text-slate-600 truncate">{t.taskTitle ?? "—"}</span>
              <span className="text-[10px] text-slate-400 flex-shrink-0">{t.completedBy}</span>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

function ProjectsWidget({ projects }: { projects: ActiveProject[] }) {
  return (
    <WidgetShell id="projects" label="Proyectos activos" icon={Folder} count={projects.length}>
      {projects.length === 0 ? (
        <EmptyState label="Sin proyectos activos" />
      ) : (
        <ul className="space-y-3">
          {projects.map((p) => {
            const pct = p.totalTasks > 0 ? Math.round((p.doneTasks / p.totalTasks) * 100) : 0;
            const pending = p.totalTasks - p.doneTasks;
            return (
              <li key={p.id}>
                <Link href={`/projects/${p.id}`} className="group block">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700 truncate group-hover:text-[#1e3a5f] transition-colors">
                      {p.name}
                    </span>
                    <span className="text-[10px] text-slate-400 flex-shrink-0 ml-2">
                      {pending > 0 ? `${pending} pendientes` : "completado"}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", pct >= 100 ? "bg-emerald-500" : "bg-[#1e3a5f]")}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{pct}% completado</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetShell>
  );
}

function fmtSecs(secs: number) {
  if (secs < 60) return `${secs}s`;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function AgentsWidget({ rows }: { rows: AgentRow[] }) {
  return (
    <WidgetShell id="agents" label="Actividad de agentes hoy" icon={Bot}>
      {rows.length === 0 ? (
        <EmptyState label="Sin actividad de agentes hoy" />
      ) : (
        <ul className="space-y-3">
          {rows.map((a, i) => (
            <li key={i} className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                style={{ backgroundColor: (a.agentColor ?? "#1e3a5f") + "20" }}
              >
                {a.agentAvatar ?? "🤖"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">{a.agentName}</p>
                <p className="text-[10px] text-slate-400">
                  {a.tasksWorked} tarea{a.tasksWorked !== 1 ? "s" : ""} · {fmtSecs(a.totalSeconds)}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-[#1e3a5f]">{fmtSecs(a.totalSeconds)}</p>
                <p className="text-[10px] text-slate-400">hoy</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

// ── Settings panel ─────────────────────────────────────────────────────────

function SettingsPanel({
  visible,
  onToggle,
  onClose,
}: {
  visible: WidgetId[];
  onToggle: (id: WidgetId) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-0 top-full mt-2 z-30 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-slate-800">Personalizar dashboard</p>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-xs text-slate-400 mb-3">Activa o desactiva los bloques que quieres ver.</p>
      <ul className="space-y-1">
        {(Object.entries(WIDGET_META) as [WidgetId, typeof WIDGET_META[WidgetId]][]).map(([id, { label, icon: Icon }]) => {
          const isOn = visible.includes(id);
          return (
            <li key={id}>
              <button
                onClick={() => onToggle(id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors",
                  isOn
                    ? "bg-[#1e3a5f]/5 text-[#1e3a5f]"
                    : "text-slate-400 hover:bg-slate-50"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="flex-1 text-left">{label}</span>
                {isOn
                  ? <Eye className="w-3.5 h-3.5" />
                  : <EyeOff className="w-3.5 h-3.5" />
                }
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

interface DashboardClientProps {
  userId: string;
  userName: string;
  doneTodayByMe: number;
  doneTodayByAgents: number;
  myPendingTasks: PendingTask[];
  activeProjects: ActiveProject[];
  completedToday: CompletedTask[];
  agentActivity: AgentRow[];
  todayStr: string;
}

export function DashboardClient({
  userId,
  userName,
  doneTodayByMe,
  doneTodayByAgents,
  myPendingTasks,
  activeProjects,
  completedToday,
  agentActivity,
  todayStr,
}: DashboardClientProps) {
  const [visibleWidgets, setVisibleWidgets] = useState<WidgetId[]>(() => loadWidgets(userId));
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(`uxuri:dash:${userId}`, JSON.stringify(visibleWidgets));
  }, [visibleWidgets, userId]);

  // Close settings on outside click
  useEffect(() => {
    if (!showSettings) return;
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSettings]);

  function toggleWidget(id: WidgetId) {
    setVisibleWidgets((prev) =>
      prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]
    );
  }

  // Derived metrics
  const pendingCount = myPendingTasks.filter((t) => t.status !== "done").length;
  const urgentCount  = myPendingTasks.filter((t) => t.priority === "urgent" || t.priority === "high").length;
  const overdueCount = myPendingTasks.filter((t) => t.dueDate && t.dueDate < todayStr).length;
  const totalToday   = doneTodayByMe + doneTodayByAgents;

  const show = (id: WidgetId) => visibleWidgets.includes(id);

  const firstName = userName.split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{greeting}, {firstName} 👋</h1>
          <p className="text-slate-500 text-sm mt-1">
            {totalToday > 0
              ? `Hoy se completaron ${totalToday} tarea${totalToday !== 1 ? "s" : ""}.`
              : "No hay tareas completadas aún hoy."}
            {pendingCount > 0 && ` Tienes ${pendingCount} pendientes.`}
          </p>
        </div>

        {/* Customize button */}
        <div className="relative flex-shrink-0" ref={settingsRef}>
          <button
            onClick={() => setShowSettings((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors",
              showSettings
                ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            )}
          >
            <Settings className="w-3.5 h-3.5" />
            Personalizar
          </button>
          {showSettings && (
            <SettingsPanel
              visible={visibleWidgets}
              onToggle={toggleWidget}
              onClose={() => setShowSettings(false)}
            />
          )}
        </div>
      </div>

      {/* KPI stat bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Completadas hoy",
            value: totalToday,
            sub: `${doneTodayByMe} yo · ${doneTodayByAgents} agentes`,
            color: "bg-emerald-50 border-emerald-100",
            numColor: "text-emerald-600",
          },
          {
            label: "Pendientes",
            value: pendingCount,
            sub: "tareas activas",
            color: "bg-blue-50 border-blue-100",
            numColor: "text-blue-600",
          },
          {
            label: "Urgentes",
            value: urgentCount,
            sub: "prioridad alta o urgente",
            color: urgentCount > 0 ? "bg-orange-50 border-orange-100" : "bg-slate-50 border-slate-100",
            numColor: urgentCount > 0 ? "text-orange-600" : "text-slate-400",
          },
          {
            label: "Vencidas",
            value: overdueCount,
            sub: "pasaron su fecha límite",
            color: overdueCount > 0 ? "bg-red-50 border-red-100" : "bg-slate-50 border-slate-100",
            numColor: overdueCount > 0 ? "text-red-600" : "text-slate-400",
          },
        ].map(({ label, value, sub, color, numColor }) => (
          <div key={label} className={cn("rounded-2xl border p-4", color)}>
            <p className={cn("text-3xl font-bold tabular-nums leading-none", numColor)}>{value}</p>
            <p className="text-sm font-semibold text-slate-700 mt-1">{label}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Widget grid */}
      {visibleWidgets.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-sm">No hay widgets activos.</p>
          <button
            onClick={() => setShowSettings(true)}
            className="mt-2 text-xs text-[#1e3a5f] hover:underline"
          >
            Personalizar →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {show("my-tasks") && (
            <MyTasksWidget tasks={myPendingTasks} />
          )}
          {show("urgent") && (
            <UrgentWidget tasks={myPendingTasks} />
          )}
          {show("overdue") && (
            <OverdueWidget tasks={myPendingTasks} todayStr={todayStr} />
          )}
          {show("completed-today") && (
            <CompletedTodayWidget
              completedToday={completedToday}
              doneTodayByMe={doneTodayByMe}
              doneTodayByAgents={doneTodayByAgents}
            />
          )}
          {show("projects") && (
            <ProjectsWidget projects={activeProjects} />
          )}
          {show("agents") && (
            <AgentsWidget rows={agentActivity} />
          )}
        </div>
      )}
    </div>
  );
}
