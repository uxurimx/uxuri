"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Target, Pencil, X, Check, Users } from "lucide-react";
import { WorkspacePicker } from "@/components/workspaces/workspace-picker";
import { ShareModal } from "@/components/sharing/share-modal";
import { cn } from "@/lib/utils";
import { ObjectiveProgress } from "./objective-progress";
import { MilestoneChecklist } from "./milestone-checklist";
import { ObjectiveAttachments } from "./objective-attachments";
import { ObjectiveAreasManager } from "./objective-areas-manager";
import { ObjectiveLinksPanel } from "./objective-links-panel";
import { ObjectiveTimeline } from "./objective-timeline";
import { ContextFeed } from "@/components/context/context-feed";
import { SavingsGoalWidget } from "./savings-goal-widget";

interface Milestone {
  id: string;
  title: string;
  done: boolean;
  sortOrder: number | null;
}

interface Attachment {
  id: string;
  name: string;
  url: string;
  size: number | null;
  type: string | null;
  createdAt: string;
}

interface LinkedItem {
  linkId: string;
  id: string;
  name?: string;
  title?: string;
  status?: string;
  areaId?: string;
}

interface LinkedAgent {
  linkId: string;
  id: string;
  name: string;
  avatar: string;
  color: string;
}

interface ObjectiveArea {
  id: string;
  objectiveId: string;
  name: string;
  color: string;
  emoji: string | null;
  sortOrder: number | null;
  createdAt: Date;
}

interface ObjectiveDetailData {
  id: string;
  title: string;
  description: string | null;
  status: "draft" | "active" | "paused" | "completed" | "cancelled";
  priority: string;
  targetDate: string | null;
  workspaceId?: string | null;
  createdAt: string;
  milestones: (Milestone & { dueDate?: string })[];
  linkedProjects: (LinkedItem & { name: string; endDate?: string })[];
  linkedTasks: (LinkedItem & { title: string; dueDate?: string })[];
  linkedAgents: LinkedAgent[];
  attachments: Attachment[];
  areas: ObjectiveArea[];
  progress: {
    tasks: number | null;
    projects: number | null;
    milestones: number | null;
    overall: number;
  };
}

const statusConfig = {
  draft:     { label: "Borrador",   className: "bg-slate-100 text-slate-600" },
  active:    { label: "Activo",     className: "bg-emerald-50 text-emerald-700" },
  paused:    { label: "Pausado",    className: "bg-amber-50 text-amber-700" },
  completed: { label: "Completado", className: "bg-blue-50 text-blue-700" },
  cancelled: { label: "Cancelado",  className: "bg-red-50 text-red-700" },
};

const TABS = [
  { id: "summary",     label: "Resumen" },
  { id: "areas",       label: "Áreas" },
  { id: "milestones",  label: "Hitos" },
  { id: "links",       label: "Vínculos" },
  { id: "timeline",    label: "Timeline" },
  { id: "attachments", label: "Adjuntos" },
  { id: "context",     label: "Contexto" },
];

interface ObjectiveDetailProps {
  objective: ObjectiveDetailData;
}

export function ObjectiveDetail({ objective: initial }: ObjectiveDetailProps) {
  const router = useRouter();
  const [objective, setObjective] = useState<ObjectiveDetailData>(initial);
  const [activeTab, setActiveTab] = useState("summary");
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(initial.title);
  const [editDescription, setEditDescription] = useState(initial.description ?? "");
  const [editWorkspaceId, setEditWorkspaceId] = useState(initial.workspaceId ?? "");
  const [editStatus, setEditStatus] = useState(initial.status);
  const [saving, setSaving] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const handleAreaAdded = (area: ObjectiveArea) => {
    setObjective((prev) => ({
      ...prev,
      areas: [...prev.areas, area],
    }));
  };

  const handleAreaUpdated = (area: ObjectiveArea) => {
    setObjective((prev) => ({
      ...prev,
      areas: prev.areas.map((a) => (a.id === area.id ? area : a)),
    }));
  };

  const handleAreaDeleted = (areaId: string) => {
    setObjective((prev) => ({
      ...prev,
      areas: prev.areas.filter((a) => a.id !== areaId),
      linkedTasks: prev.linkedTasks.map((t) =>
        t.areaId === areaId ? { ...t, areaId: undefined } : t
      ),
      linkedProjects: prev.linkedProjects.map((p) =>
        p.areaId === areaId ? { ...p, areaId: undefined } : p
      ),
    }));
  };

  const handleLinksUpdate = () => {
    // Refetch objective data
    fetch(`/api/objectives/${objective.id}`)
      .then((res) => res.json())
      .then((data) => setObjective(data))
      .catch(console.error);
  };

  const sc = statusConfig[objective.status];

  async function saveEdit() {
    setSaving(true);
    try {
      const res = await fetch(`/api/objectives/${objective.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          status: editStatus,
          workspaceId: editWorkspaceId || null,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setObjective((prev) => ({ ...prev, ...updated }));
        setEditingTitle(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteObjective() {
    if (!confirm("¿Eliminar este objetivo?")) return;
    await fetch(`/api/objectives/${objective.id}`, { method: "DELETE" });
    router.push("/objectives");
  }

  async function deleteLink(type: "project" | "task" | "agent", linkId: string) {
    await fetch(`/api/objectives/${objective.id}/links`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, linkId }),
    });
    if (type === "project") {
      setObjective((prev) => ({
        ...prev,
        linkedProjects: prev.linkedProjects.filter((p) => p.linkId !== linkId),
      }));
    } else if (type === "task") {
      setObjective((prev) => ({
        ...prev,
        linkedTasks: prev.linkedTasks.filter((t) => t.linkId !== linkId),
      }));
    } else {
      setObjective((prev) => ({
        ...prev,
        linkedAgents: prev.linkedAgents.filter((a) => a.linkId !== linkId),
      }));
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/objectives" className="text-slate-400 hover:text-slate-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <div className="space-y-2">
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full text-2xl font-bold text-slate-900 bg-transparent border-b border-[#1e3a5f] focus:outline-none"
                autoFocus
              />
              <WorkspacePicker value={editWorkspaceId} onChange={setEditWorkspaceId} />
              <div className="flex items-center gap-2">
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as ObjectiveDetailData["status"])}
                  className="px-2 py-1 border border-slate-200 rounded text-sm focus:outline-none"
                >
                  <option value="draft">Borrador</option>
                  <option value="active">Activo</option>
                  <option value="paused">Pausado</option>
                  <option value="completed">Completado</option>
                  <option value="cancelled">Cancelado</option>
                </select>
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="flex items-center gap-1 px-3 py-1 bg-[#1e3a5f] text-white rounded text-sm"
                >
                  <Check className="w-3.5 h-3.5" /> Guardar
                </button>
                <button
                  onClick={() => { setEditingTitle(false); setEditTitle(objective.title); }}
                  className="px-3 py-1 border border-slate-200 text-slate-600 rounded text-sm"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-slate-900">{objective.title}</h1>
                <span
                  className={cn(
                    "inline-flex px-2 py-0.5 rounded-full text-xs font-medium mt-1",
                    sc.className
                  )}
                >
                  {sc.label}
                </span>
              </div>
              <button
                onClick={() => setShowShare(true)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-sm font-medium"
                title="Compartir"
              >
                <Users className="w-4 h-4" /> Compartir
              </button>
              <button
                onClick={() => setEditingTitle(true)}
                className="flex-shrink-0 p-1.5 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 transition-colors"
                title="Editar"
              >
                <Pencil className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                activeTab === tab.id
                  ? "border-[#1e3a5f] text-[#1e3a5f]"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div>
        {/* Summary */}
        {activeTab === "summary" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
              {objective.description && (
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="font-semibold text-slate-900 mb-2">Descripción</h3>
                  <p className="text-sm text-slate-600 whitespace-pre-line">{objective.description}</p>
                </div>
              )}
              {!objective.description && !editingTitle && (
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <button
                    onClick={() => { setEditDescription(""); setEditingTitle(true); }}
                    className="text-sm text-slate-400 hover:text-slate-600"
                  >
                    + Añadir descripción
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-4">
              {/* Progress */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900 mb-4">Progreso</h3>
                <ObjectiveProgress progress={objective.progress} />
              </div>
              {/* Meta */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-2">
                <h3 className="font-semibold text-slate-900 mb-2">Detalles</h3>
                {objective.targetDate && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Fecha meta</span>
                    <span className="text-slate-700 font-medium">
                      {new Date(objective.targetDate).toLocaleDateString("es-MX")}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Prioridad</span>
                  <span className="text-slate-700 font-medium capitalize">{objective.priority}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Hitos</span>
                  <span className="text-slate-700 font-medium">{objective.milestones.length}</span>
                </div>
              </div>
              {/* Savings goals linked to this objective */}
              <SavingsGoalWidget objectiveId={objective.id} />

              {/* Delete */}
              <button
                onClick={deleteObjective}
                className="w-full py-2 text-xs text-red-400 hover:text-red-600 transition-colors"
              >
                Eliminar objetivo
              </button>
            </div>
          </div>
        )}

        {/* Milestones */}
        {activeTab === "milestones" && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 max-w-2xl">
            <h3 className="font-semibold text-slate-900 mb-4">Hitos</h3>
            <MilestoneChecklist
              objectiveId={objective.id}
              initialMilestones={objective.milestones}
            />
          </div>
        )}

        {/* Areas */}
        {activeTab === "areas" && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 max-w-2xl">
            <h3 className="font-semibold text-slate-900 mb-4">Áreas</h3>
            <ObjectiveAreasManager
              areas={objective.areas}
              objectiveId={objective.id}
              onAreaAdded={handleAreaAdded}
              onAreaUpdated={handleAreaUpdated}
              onAreaDeleted={handleAreaDeleted}
            />
          </div>
        )}

        {/* Links */}
        {activeTab === "links" && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 max-w-2xl">
            <h3 className="font-semibold text-slate-900 mb-4">Vínculos</h3>
            <ObjectiveLinksPanel
              objectiveId={objective.id}
              areas={objective.areas}
              linkedTasks={objective.linkedTasks}
              linkedProjects={objective.linkedProjects}
              onLinkAdded={handleLinksUpdate}
              onLinkRemoved={handleLinksUpdate}
            />
          </div>
        )}

        {/* Timeline */}
        {activeTab === "timeline" && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-900 mb-4">Línea de tiempo</h3>
            <ObjectiveTimeline
              linkedTasks={objective.linkedTasks}
              linkedProjects={objective.linkedProjects}
              milestones={objective.milestones}
              areas={objective.areas}
            />
          </div>
        )}

        {/* Attachments */}
        {activeTab === "attachments" && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 max-w-2xl">
            <h3 className="font-semibold text-slate-900 mb-4">Adjuntos</h3>
            <ObjectiveAttachments
              objectiveId={objective.id}
              initialAttachments={objective.attachments}
            />
          </div>
        )}

        {/* Context */}
        {activeTab === "context" && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 max-w-2xl">
            <ContextFeed entityType="objective" entityId={objective.id} />
          </div>
        )}
      </div>

      {showShare && (
        <ShareModal
          resourceType="objective"
          resourceId={objective.id}
          resourceTitle={objective.title}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}
