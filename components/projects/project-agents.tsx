"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Plus, X, Trash2, Code2, GitBranch, Globe, Pencil, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

export type ProjectAssignment = {
  id: string;
  agentId: string;
  scope: string | null;
  createdAt: Date;
  agentName: string;
  agentAvatar: string;
  agentColor: string;
  agentSpecialty: string | null;
  agentIsGlobal: boolean;
  agentModel: string | null;
  taskCount: number;
};

export type AgentOption = {
  id: string;
  name: string;
  avatar: string;
  color: string;
  isGlobal: boolean;
};

export type ProjectCodeConfig = {
  linkedCodePath: string | null;
  linkedRepo: string | null;
  techStack: string | null;
};

// ── Code Config Panel ─────────────────────────────────────────────────────────

function CodeConfigPanel({
  projectId,
  config,
}: {
  projectId: string;
  config: ProjectCodeConfig;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    linkedCodePath: config.linkedCodePath ?? "",
    linkedRepo: config.linkedRepo ?? "",
    techStack: config.techStack ?? "",
  });

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        linkedCodePath: form.linkedCodePath || null,
        linkedRepo: form.linkedRepo || null,
        techStack: form.techStack || null,
      }),
    });
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-900">Código vinculado</h3>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            Editar
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Ruta local</label>
            <input
              value={form.linkedCodePath}
              onChange={(e) => setForm((f) => ({ ...f, linkedCodePath: e.target.value }))}
              placeholder="/home/dev/Projects/tekton/Projects/WB"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Repositorio git</label>
            <input
              value={form.linkedRepo}
              onChange={(e) => setForm((f) => ({ ...f, linkedRepo: e.target.value }))}
              placeholder="https://github.com/org/repo"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Stack técnico (contexto para el agente)</label>
            <textarea
              value={form.techStack}
              onChange={(e) => setForm((f) => ({ ...f, techStack: e.target.value }))}
              rows={3}
              placeholder="Next.js 15, Tailwind, Neon PostgreSQL. Archivos principales en src/app. Despliegue en Vercel."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(false)}
              className="px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#1e3a5f] text-white rounded-lg hover:bg-[#162d4a] disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          {config.linkedCodePath ? (
            <div className="flex items-start gap-2">
              <Code2 className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
              <code className="text-slate-700 font-mono text-xs break-all">{config.linkedCodePath}</code>
            </div>
          ) : null}
          {config.linkedRepo ? (
            <div className="flex items-start gap-2">
              <GitBranch className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
              <span className="text-slate-600 text-xs break-all">{config.linkedRepo}</span>
            </div>
          ) : null}
          {config.techStack ? (
            <p className="text-slate-500 text-xs mt-2 leading-relaxed">{config.techStack}</p>
          ) : null}
          {!config.linkedCodePath && !config.linkedRepo && !config.techStack && (
            <p className="text-slate-400 text-xs italic">
              Sin código vinculado. Configura la ruta para que el agente Developer pueda hacer cambios directamente.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Add Agent Modal ───────────────────────────────────────────────────────────

function AddAgentModal({
  projectId,
  availableAgents,
  assignedIds,
  onClose,
}: {
  projectId: string;
  availableAgents: AgentOption[];
  assignedIds: Set<string>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState("");
  const [scope, setScope] = useState("");
  const [saving, setSaving] = useState(false);

  const unassigned = availableAgents.filter((a) => !assignedIds.has(a.id));

  async function handleAdd() {
    if (!selectedId) return;
    setSaving(true);
    await fetch(`/api/projects/${projectId}/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: selectedId, scope: scope || undefined }),
    });
    setSaving(false);
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Asignar agente al proyecto</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Agente</label>
            {unassigned.length === 0 ? (
              <p className="text-sm text-slate-500 italic">Todos los agentes ya están asignados.</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {unassigned.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setSelectedId(a.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors",
                      selectedId === a.id
                        ? "border-[#1e3a5f] bg-[#1e3a5f]/5"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    )}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                      style={{ backgroundColor: a.color + "18" }}
                    >
                      {a.avatar}
                    </div>
                    <span className="text-sm font-medium text-slate-800">{a.name}</span>
                    {a.isGlobal && (
                      <span className="ml-auto text-xs px-1.5 py-0.5 bg-violet-50 text-violet-600 rounded-full flex items-center gap-1">
                        <Globe className="w-2.5 h-2.5" /> Global
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Alcance <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              rows={2}
              placeholder="ej. Solo modificar src/app/dashboard y src/components/ui"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleAdd}
              disabled={!selectedId || saving}
              className="flex-1 px-4 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#162d4a] disabled:opacity-50"
            >
              {saving ? "Asignando..." : "Asignar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Assignment Card ───────────────────────────────────────────────────────────

function AssignmentCard({
  assignment,
  projectId,
  onRemove,
}: {
  assignment: ProjectAssignment;
  projectId: string;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-sm transition-shadow group">
      <div className="h-1" style={{ backgroundColor: assignment.agentColor }} />
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ backgroundColor: assignment.agentColor + "18" }}
            >
              {assignment.agentAvatar}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-sm text-slate-900">{assignment.agentName}</span>
                {assignment.agentIsGlobal && (
                  <span className="text-xs px-1.5 py-0.5 bg-violet-50 text-violet-600 rounded-full flex items-center gap-1">
                    <Globe className="w-2.5 h-2.5" /> Global
                  </span>
                )}
              </div>
              {assignment.agentSpecialty && (
                <p className="text-xs text-slate-400">{assignment.agentSpecialty}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => onRemove(assignment.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {assignment.scope && (
          <p className="text-xs text-slate-500 mt-2 bg-slate-50 rounded-lg px-2.5 py-1.5 leading-relaxed">
            {assignment.scope}
          </p>
        )}

        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {assignment.taskCount === 0 ? "Sin tareas activas" : `${assignment.taskCount} tarea${assignment.taskCount !== 1 ? "s" : ""} activa${assignment.taskCount !== 1 ? "s" : ""}`}
          </span>
          <Link
            href={`/agents/${assignment.agentId}`}
            className="text-xs text-slate-400 hover:text-[#1e3a5f] transition-colors"
          >
            Ver agente →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function ProjectAgents({
  projectId,
  initialAssignments,
  availableAgents,
  codeConfig,
}: {
  projectId: string;
  initialAssignments: ProjectAssignment[];
  availableAgents: AgentOption[];
  codeConfig: ProjectCodeConfig;
}) {
  const router = useRouter();
  const [assignments, setAssignments] = useState(initialAssignments);
  const [addOpen, setAddOpen] = useState(false);

  const assignedIds = new Set(assignments.map((a) => a.agentId));

  async function handleRemove(assignmentId: string) {
    if (!confirm("¿Desasignar este agente del proyecto?")) return;
    setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
    await fetch(`/api/projects/${projectId}/agents?assignmentId=${assignmentId}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {/* Código vinculado */}
      <CodeConfigPanel projectId={projectId} config={codeConfig} />

      {/* Header de agentes */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Agentes asignados</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Los agentes asignados pueden recibir tareas de este proyecto
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e3a5f] text-white rounded-lg text-xs font-medium hover:bg-[#162d4a] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Asignar agente
        </button>
      </div>

      {assignments.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 border-dashed p-10 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3 text-2xl">
            <Bot className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-700 mb-1">Sin agentes asignados</p>
          <p className="text-xs text-slate-400 max-w-xs leading-relaxed mb-4">
            Asigna el agente Developer u otros agentes para que puedan recibir tareas de este proyecto.
          </p>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e3a5f] text-white rounded-lg text-xs font-medium hover:bg-[#162d4a]"
          >
            <Plus className="w-3.5 h-3.5" />
            Asignar primer agente
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {assignments.map((a) => (
            <AssignmentCard
              key={a.id}
              assignment={a}
              projectId={projectId}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}

      {addOpen && (
        <AddAgentModal
          projectId={projectId}
          availableAgents={availableAgents}
          assignedIds={assignedIds}
          onClose={() => setAddOpen(false)}
        />
      )}
    </div>
  );
}
