"use client";

import { useState } from "react";
import Link from "next/link";
import { cn, formatDate } from "@/lib/utils";
import { ArrowLeft, Calendar, User, Flag, Pencil, Clock, Tag, DollarSign } from "lucide-react";
import { CyclePanel } from "./cycle-panel";
import { KanbanBoard, type TaskWithProject, type CustomColumn } from "@/components/tasks/kanban-board";
import { EntityChatFiles } from "@/components/chat/entity-chat-files";
import { ContextFeed } from "@/components/context/context-feed";
import { ProjectModal, type ProjectForModal } from "./project-modal";
import { ProjectFinancials, type AccountOption } from "./project-financials";

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
  cycleMinutes:  number | null;
  lastCycleAt: Date | null;
  nextCycleAt: Date | null;
  momentum:    number;
  // Finanzas
  totalAmount?: string | null;
  currency?: string | null;
  paymentType?: string | null;
};

const statusConfig = {
  planning:  { label: "Planeación", className: "bg-slate-100 text-slate-600" },
  active:    { label: "Activo",     className: "bg-emerald-50 text-emerald-700" },
  paused:    { label: "Pausado",    className: "bg-amber-50 text-amber-700" },
  completed: { label: "Completado", className: "bg-blue-50 text-blue-700" },
  cancelled: { label: "Cancelado",  className: "bg-red-50 text-red-700" },
};

type AgentOption = { id: string; name: string; avatar: string; color: string };
type ClientOption = { id: string; name: string };
type ObjectiveOption = { id: string; title: string };

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
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"tareas" | "finanzas" | "contexto" | "chat">("tareas");
  const status = statusConfig[project.status];

  const tabs = [
    { id: "tareas",    label: "Tareas",    count: tasks.length },
    { id: "finanzas",  label: "Finanzas",  icon: <DollarSign className="w-3.5 h-3.5" /> },
    { id: "contexto",  label: "Contexto" },
    { id: "chat",      label: "Chat & Archivos" },
  ] as const;

  const projectForModal: ProjectForModal = {
    id: project.id,
    name: project.name,
    description: project.description,
    clientId: project.clientId,
    clientName: project.clientName,
    status: project.status,
    priority: project.priority,
    privacy: project.privacy,
    range: project.range,
    category: project.category,
    startDate: project.startDate,
    endDate: project.endDate,
    createdBy: project.createdBy,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/projects" className="text-slate-400 hover:text-slate-600 transition-colors mt-1">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900 flex-1">{project.name}</h1>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", status.className)}>
                {status.label}
              </span>
              <button
                onClick={() => setEditOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 hover:border-slate-300 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                Editar
              </button>
            </div>
          </div>
          {project.description && (
            <p className="text-slate-500 text-sm mt-1">{project.description}</p>
          )}
        </div>
      </div>

      {/* Project meta */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex flex-wrap gap-4">
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
          {project.range && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>{project.range === "short" ? "Corto plazo" : "Largo plazo"}</span>
            </div>
          )}
          {project.category && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Tag className="w-4 h-4 text-slate-400" />
              <span>{project.category}</span>
            </div>
          )}
        </div>
      </div>

      {/* Ciclo de revisión */}
      <CyclePanel
        projectId={project.id}
        cycleMinutes={project.cycleMinutes}
        lastCycleAt={project.lastCycleAt}
        nextCycleAt={project.nextCycleAt}
        momentum={project.momentum}
      />

      {/* Tabs */}
      <div>
        <div className="flex gap-1 border-b border-slate-200 mb-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
                activeTab === tab.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              {"icon" in tab && tab.icon}
              {tab.label}
              {"count" in tab && tab.count !== undefined && (
                <span className={cn(
                  "text-xs px-1.5 py-0.5 rounded-full",
                  activeTab === tab.id ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab: Tareas */}
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

        {/* Tab: Finanzas */}
        {activeTab === "finanzas" && (
          <ProjectFinancials
            projectId={project.id}
            totalAmount={project.totalAmount ?? null}
            currency={project.currency ?? null}
            paymentType={project.paymentType ?? null}
            accounts={accounts ?? []}
          />
        )}

        {/* Tab: Contexto */}
        {activeTab === "contexto" && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <ContextFeed entityType="project" entityId={project.id} />
          </div>
        )}

        {/* Tab: Chat & Archivos */}
        {activeTab === "chat" && currentUserId && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <EntityChatFiles entityId={project.id} entityType="project" entityName={project.name} currentUserId={currentUserId} />
          </div>
        )}
      </div>

      {/* Edit modal */}
      <ProjectModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        project={projectForModal}
        clients={clients ?? []}
        objectives={objectives}
        initialMode="edit"
      />
    </div>
  );
}
