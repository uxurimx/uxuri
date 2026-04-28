"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { cn, formatDate } from "@/lib/utils";
import {
  ArrowLeft, Calendar, User, Flag, Pencil, Clock, Tag, DollarSign,
  Share2, CalendarPlus, RotateCcw, Zap, X, ChevronDown,
  TrendingUp, CheckCircle2, AlertTriangle, Minus,
} from "lucide-react";
import { CyclePanel } from "./cycle-panel";
import { KanbanBoard, type TaskWithProject, type CustomColumn } from "@/components/tasks/kanban-board";
import { EntityChatFiles } from "@/components/chat/entity-chat-files";
import { ContextFeed } from "@/components/context/context-feed";
import { ProjectModal, type ProjectForModal } from "./project-modal";
import { ProjectFinancials, type AccountOption } from "./project-financials";
import { ProjectAgents, type ProjectAssignment, type AgentOption as AgentOptionPA } from "./project-agents";
import { ShareModal } from "@/components/sharing/share-modal";
import { getCycleInfo, formatDuration } from "@/lib/cycles";
import { useRouter } from "next/navigation";

type ProjectWithClient = {
  id: string;
  name: string;
  description: string | null;
  clientId: string | null;
  status: "planning" | "active" | "paused" | "completed" | "cancelled";
  priority: "low" | "medium" | "high";
  privacy: string;
  range: string | null;
  category: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: Date;
  createdBy: string | null;
  clientName: string | null;
  cycleMinutes: number | null;
  lastCycleAt: Date | null;
  nextCycleAt: Date | null;
  momentum: number;
  totalAmount?: string | null;
  currency?: string | null;
  paymentType?: string | null;
  linkedCodePath?: string | null;
  linkedRepo?: string | null;
  techStack?: string | null;
};

const STATUS_CONFIG = {
  planning:  { label: "Planeación", className: "bg-slate-100 text-slate-600",   border: "border-slate-300" },
  active:    { label: "Activo",     className: "bg-emerald-50 text-emerald-700", border: "border-emerald-300" },
  paused:    { label: "Pausado",    className: "bg-amber-50 text-amber-700",     border: "border-amber-300" },
  completed: { label: "Completado", className: "bg-blue-50 text-blue-700",       border: "border-blue-300" },
  cancelled: { label: "Cancelado",  className: "bg-red-50 text-red-700",         border: "border-red-300" },
};

const PRIORITY_CONFIG = {
  low:    { label: "Baja",  color: "text-slate-400" },
  medium: { label: "Media", color: "text-amber-500" },
  high:   { label: "Alta",  color: "text-orange-500" },
};

type AgentOption = { id: string; name: string; avatar: string; color: string };
type ClientOption = { id: string; name: string };
type ObjectiveOption = { id: string; title: string };

function computeHealth(
  taskCount: number,
  doneCount: number,
  momentum: number,
  endDate: string | null,
  status: string
): { level: "excellent" | "good" | "fair" | "poor"; label: string; color: string; icon: React.ReactNode } {
  if (status === "completed") return { level: "excellent", label: "Completado", color: "text-emerald-600", icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
  if (status === "cancelled") return { level: "poor",      label: "Cancelado",  color: "text-slate-400",  icon: <Minus className="w-3.5 h-3.5" /> };

  let score = 100;
  const today = new Date(); today.setHours(0,0,0,0);
  if (endDate && new Date(endDate) < today) score -= 40;
  if (momentum < 30) score -= 30;
  else if (momentum < 50) score -= 20;
  else if (momentum < 70) score -= 10;
  if (taskCount > 0 && (doneCount / taskCount) < 0.2) score -= 10;

  if (score >= 85) return { level: "excellent", label: "Excelente", color: "text-emerald-600", icon: <TrendingUp className="w-3.5 h-3.5" /> };
  if (score >= 65) return { level: "good",      label: "Buena",     color: "text-blue-600",    icon: <TrendingUp className="w-3.5 h-3.5" /> };
  if (score >= 40) return { level: "fair",      label: "Regular",   color: "text-amber-500",   icon: <AlertTriangle className="w-3.5 h-3.5" /> };
  return               { level: "poor",      label: "Baja",      color: "text-red-500",     icon: <AlertTriangle className="w-3.5 h-3.5" /> };
}

function daysRemaining(endDate: string | null): { days: number; label: string; color: string } | null {
  if (!endDate) return null;
  const diff = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000);
  if (diff < 0)  return { days: Math.abs(diff), label: `${Math.abs(diff)} días vencido`, color: "text-red-500" };
  if (diff === 0) return { days: 0,             label: "Vence hoy",                      color: "text-orange-500" };
  return               { days: diff,            label: `${diff} días restantes`,          color: diff <= 7 ? "text-amber-500" : "text-slate-500" };
}

function timelinePercent(startDate: string | null, endDate: string | null): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate).getTime();
  const end   = new Date(endDate).getTime();
  const now   = Date.now();
  if (now <= start) return 0;
  if (now >= end)   return 100;
  return Math.round(((now - start) / (end - start)) * 100);
}

export function ProjectDetail({
  project,
  tasks,
  projects,
  users,
  agents,
  clients,
  objectives,
  customColumns,
  accounts,
  currentUserId,
  canEditTasks,
  projectAssignments,
  allAgentsForAssign,
}: {
  project: ProjectWithClient;
  tasks: TaskWithProject[];
  projects?: { id: string; name: string }[];
  users?: { id: string; name: string | null }[];
  agents?: AgentOption[];
  clients?: ClientOption[];
  objectives?: ObjectiveOption[];
  customColumns?: CustomColumn[];
  accounts?: AccountOption[];
  currentUserId?: string;
  canEditTasks?: boolean;
  projectAssignments?: ProjectAssignment[];
  allAgentsForAssign?: AgentOptionPA[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editOpen,   setEditOpen]   = useState(false);
  const [shareOpen,  setShareOpen]  = useState(false);
  const [cycleOpen,  setCycleOpen]  = useState(false);
  const [activeTab,  setActiveTab]  = useState<"tareas" | "finanzas" | "contexto" | "chat" | "agentes">("tareas");
  const [curStatus,  setCurStatus]  = useState(project.status);

  const statusCfg  = STATUS_CONFIG[curStatus];
  const priorityCfg = PRIORITY_CONFIG[project.priority];
  const taskCount  = tasks.length;
  const doneCount  = tasks.filter(t => t.status === "done").length;
  const taskPct    = taskCount > 0 ? Math.round((doneCount / taskCount) * 100) : 0;
  const health     = computeHealth(taskCount, doneCount, project.momentum, project.endDate, curStatus);
  const remaining  = daysRemaining(project.endDate);
  const tlPct      = timelinePercent(project.startDate, project.endDate);
  const cycleInfo  = getCycleInfo(project.cycleMinutes, project.lastCycleAt, project.nextCycleAt);
  const budget     = Number(project.totalAmount ?? 0);

  async function handleStatusChange(newStatus: string) {
    setCurStatus(newStatus as typeof curStatus);
    await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    startTransition(() => router.refresh());
  }

  const tabs = [
    { id: "tareas",   label: "Tareas",     count: tasks.length },
    { id: "finanzas", label: "Finanzas" },
    { id: "contexto", label: "Contexto" },
    { id: "chat",     label: "Chat" },
    { id: "agentes",  label: "Agentes",    count: projectAssignments?.length },
  ] as const;

  const projectForModal: ProjectForModal = {
    id: project.id, name: project.name, description: project.description,
    clientId: project.clientId, clientName: project.clientName,
    status: curStatus, priority: project.priority, privacy: project.privacy,
    range: project.range, category: project.category,
    startDate: project.startDate, endDate: project.endDate,
    createdBy: project.createdBy,
  };

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <Link href="/projects" className="text-slate-400 hover:text-slate-600 transition-colors mt-1.5 flex-shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 leading-tight">{project.name}</h1>
          {project.description && (
            <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">{project.description}</p>
          )}
          {/* Action bar */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {/* Status dropdown */}
            <div className="relative">
              <select
                value={curStatus}
                onChange={(e) => handleStatusChange(e.target.value)}
                className={cn(
                  "appearance-none text-xs font-semibold px-3 py-1.5 rounded-full border cursor-pointer pr-7 transition-colors focus:outline-none",
                  statusCfg.className, statusCfg.border
                )}
              >
                <option value="planning">Planeación</option>
                <option value="active">Activo</option>
                <option value="paused">Pausado</option>
                <option value="completed">Completado</option>
                <option value="cancelled">Cancelado</option>
              </select>
              <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
            </div>

            <button
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs hover:bg-slate-50 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" /> Editar
            </button>
            <button
              onClick={() => setShareOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs hover:bg-slate-50 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" /> Compartir
            </button>
            <Link
              href="/schedule"
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs hover:bg-slate-50 transition-colors"
            >
              <CalendarPlus className="w-3.5 h-3.5" /> Planificar
            </Link>
            <button
              onClick={() => setCycleOpen(true)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs transition-colors",
                project.cycleMinutes
                  ? cn("border-slate-300 text-slate-700 bg-slate-50", cycleInfo.phase !== "none" && cycleInfo.badgeClass)
                  : "border-slate-200 text-slate-400 hover:bg-slate-50"
              )}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {project.cycleMinutes ? `Ciclo · ${cycleInfo.label || "activo"}` : "Ciclo"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mini Dashboard ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Top: metadata */}
        <div className="flex flex-wrap items-center gap-3 px-5 pt-4 pb-3 border-b border-slate-100 text-xs text-slate-500">
          {project.clientName && (
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              {project.clientName}
            </span>
          )}
          <span className={cn("flex items-center gap-1.5 font-medium", priorityCfg.color)}>
            <Flag className="w-3.5 h-3.5" />
            {priorityCfg.label}
          </span>
          {project.range && (
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {project.range === "short" ? "Corto plazo" : "Largo plazo"}
            </span>
          )}
          {project.category && (
            <span className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-slate-400" />
              {project.category}
            </span>
          )}
          {(project.startDate || project.endDate) && (
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {project.startDate ? formatDate(project.startDate) : "—"}
              {" → "}
              {project.endDate ? formatDate(project.endDate) : "Sin fecha"}
            </span>
          )}
          {remaining && (
            <span className={cn("font-medium", remaining.color)}>{remaining.label}</span>
          )}
        </div>

        {/* KPI bars */}
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
          {/* Tasks */}
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Tareas</span>
              <span className="text-xs text-slate-500">{doneCount}/{taskCount}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-1">
              <div
                className={cn("h-full rounded-full transition-all", taskPct === 100 ? "bg-emerald-400" : "bg-[#1e3a5f]")}
                style={{ width: `${taskPct}%` }}
              />
            </div>
            <p className="text-xs text-slate-400">{taskPct}% completado · {taskCount - doneCount} pendientes</p>
          </div>

          {/* Budget */}
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Presupuesto</span>
              {project.currency && <span className="text-xs text-slate-400">{project.currency}</span>}
            </div>
            {budget > 0 ? (
              <>
                <p className="text-lg font-bold text-slate-800 leading-none mb-1">
                  {budget.toLocaleString("es-MX", { style: "currency", currency: project.currency ?? "MXN", minimumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-slate-400 capitalize">{project.paymentType ?? "Fijo"}</p>
              </>
            ) : (
              <p className="text-sm text-slate-300 italic">Sin presupuesto</p>
            )}
          </div>

          {/* Timeline */}
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Timeline</span>
              <span className="text-xs text-slate-500">{tlPct}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-1">
              <div
                className={cn("h-full rounded-full transition-all", tlPct > 90 ? "bg-red-400" : tlPct > 70 ? "bg-amber-400" : "bg-[#1e3a5f]")}
                style={{ width: `${Math.min(tlPct, 100)}%` }}
              />
            </div>
            <p className={cn("text-xs", remaining?.color ?? "text-slate-400")}>
              {remaining?.label ?? (project.endDate ? "Sin fecha de fin" : "Sin fecha definida")}
            </p>
          </div>
        </div>

        {/* Bottom: health + momentum + cycle */}
        <div className="flex flex-wrap items-center gap-4 px-5 py-3 bg-slate-50 border-t border-slate-100 text-xs">
          <span className={cn("flex items-center gap-1.5 font-medium", health.color)}>
            {health.icon}
            Salud: {health.label}
          </span>
          <span className="flex items-center gap-1.5 text-slate-500">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Momentum: <strong className={cn(
              "ml-0.5",
              project.momentum >= 70 ? "text-emerald-600" : project.momentum >= 40 ? "text-amber-500" : "text-red-500"
            )}>{project.momentum}%</strong>
          </span>
          {project.cycleMinutes && (
            <span className="flex items-center gap-1.5 text-slate-500">
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              {cycleInfo.phase !== "none" ? (
                <span className={cn("font-medium", cycleInfo.badgeClass.replace("px-1.5 py-0.5 rounded", ""))}>{cycleInfo.label}</span>
              ) : (
                <span>Ciclo: {formatDuration(project.cycleMinutes)}</span>
              )}
            </span>
          )}
          {!project.cycleMinutes && (
            <button onClick={() => setCycleOpen(true)} className="text-slate-400 hover:text-[#1e3a5f] transition-colors">
              + Configurar ciclo
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div>
        {/* Tab strip — horizontally scrollable on mobile */}
        <div className="relative">
          <div className="flex overflow-x-auto scrollbar-none border-b border-slate-200 mb-4 -mx-1 px-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap flex-shrink-0",
                  activeTab === tab.id
                    ? "border-[#1e3a5f] text-[#1e3a5f]"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                )}
              >
                {tab.label}
                {"count" in tab && tab.count !== undefined && tab.count > 0 && (
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                    activeTab === tab.id ? "bg-[#1e3a5f]/10 text-[#1e3a5f]" : "bg-slate-100 text-slate-500"
                  )}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "tareas" && (
          <KanbanBoard
            initialTasks={tasks}
            initialCustomColumns={customColumns}
            projectId={project.id}
            showProjectName={false}
            projects={projects}
            users={users}
            agents={agents}
            clients={clients}
            objectives={objectives}
            currentUserId={currentUserId}
            canEditTasks={canEditTasks}
          />
        )}
        {activeTab === "finanzas" && (
          <ProjectFinancials
            projectId={project.id}
            totalAmount={project.totalAmount ?? null}
            currency={project.currency ?? null}
            paymentType={project.paymentType ?? null}
            accounts={accounts ?? []}
          />
        )}
        {activeTab === "contexto" && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <ContextFeed entityType="project" entityId={project.id} />
          </div>
        )}
        {activeTab === "chat" && currentUserId && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <EntityChatFiles entityId={project.id} entityType="project" entityName={project.name} currentUserId={currentUserId} />
          </div>
        )}
        {activeTab === "agentes" && (
          <ProjectAgents
            projectId={project.id}
            initialAssignments={projectAssignments ?? []}
            availableAgents={allAgentsForAssign ?? []}
            codeConfig={{
              linkedCodePath: project.linkedCodePath ?? null,
              linkedRepo: project.linkedRepo ?? null,
              techStack: project.techStack ?? null,
            }}
          />
        )}
      </div>

      {/* ── Cycle modal ── */}
      {cycleOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[2px]" onClick={() => setCycleOpen(false)}>
          <div
            className="bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-md mx-0 sm:mx-4 max-h-[90vh] overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-slate-400" />
                <h3 className="font-semibold text-slate-800">Ciclo de revisión</h3>
              </div>
              <button onClick={() => setCycleOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <CyclePanel
                projectId={project.id}
                cycleMinutes={project.cycleMinutes}
                lastCycleAt={project.lastCycleAt}
                nextCycleAt={project.nextCycleAt}
                momentum={project.momentum}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Edit modal ── */}
      <ProjectModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        project={projectForModal}
        clients={clients ?? []}
        objectives={objectives}
        initialMode="edit"
      />

      {/* ── Share modal ── */}
      {shareOpen && (
        <ShareModal
          resourceType="project"
          resourceId={project.id}
          resourceTitle={project.name}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}
