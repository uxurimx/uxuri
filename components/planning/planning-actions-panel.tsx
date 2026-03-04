"use client";

import { useState } from "react";
import { Plus, CheckSquare, Briefcase, Target, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import Link from "next/link";

type CreatedEntity = {
  type: "task" | "project" | "objective";
  entity: { id: string; title?: string; name?: string };
};

type Props = {
  sessionId: string;
  contextType: string;
  contextSnapshot: Record<string, unknown> | null;
};

type FormType = "task" | "project" | "objective" | null;

export function PlanningActionsPanel({ sessionId, contextType, contextSnapshot }: Props) {
  const [activeForm, setActiveForm] = useState<FormType>(null);
  const [created, setCreated] = useState<CreatedEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  async function handleCreate(type: "task" | "project" | "objective") {
    if (!title.trim()) return;
    setLoading(true);
    try {
      const data =
        type === "task"
          ? { title: title.trim(), description: description.trim() || undefined }
          : type === "project"
          ? { name: title.trim(), description: description.trim() || undefined }
          : { title: title.trim(), description: description.trim() || undefined };

      const res = await fetch(`/api/planning/${sessionId}/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, data }),
      });
      if (res.ok) {
        const result = await res.json();
        setCreated((prev) => [...prev, result]);
        setTitle("");
        setDescription("");
        setActiveForm(null);
      }
    } finally {
      setLoading(false);
    }
  }

  const entityUrl = (e: CreatedEntity) => {
    if (e.type === "task") return "/tasks";
    if (e.type === "project") return `/projects/${e.entity.id}`;
    return `/objectives/${e.entity.id}`;
  };

  const entityLabel = (e: CreatedEntity) =>
    e.entity.title ?? e.entity.name ?? "Sin título";

  return (
    <div className="p-3 space-y-4">
      {/* Context info */}
      {contextType !== "blank" && contextSnapshot && (
        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Contexto
          </p>
          <p className="text-sm font-medium text-slate-900 line-clamp-2">
            {(contextSnapshot.title ?? contextSnapshot.name) as string}
          </p>
        </div>
      )}

      {/* Create buttons */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Crear desde sesión
        </p>
        <div className="space-y-1.5">
          {(["task", "project", "objective"] as const).map((type) => {
            const icons = { task: CheckSquare, project: Briefcase, objective: Target };
            const labels = { task: "Tarea", project: "Proyecto", objective: "Objetivo" };
            const Icon = icons[type];
            const isActive = activeForm === type;
            return (
              <div key={type}>
                <button
                  onClick={() => setActiveForm(isActive ? null : type)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:border-[#1e3a5f]/30 hover:text-[#1e3a5f] transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5" />
                    + {labels[type]}
                  </span>
                  {isActive ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                {isActive && (
                  <div className="mt-1.5 p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                    <input
                      autoFocus
                      placeholder={type === "project" ? "Nombre del proyecto" : "Título"}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]"
                    />
                    <textarea
                      placeholder="Descripción (opcional)"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]"
                    />
                    <button
                      onClick={() => handleCreate(type)}
                      disabled={!title.trim() || loading}
                      className="w-full py-2 bg-[#1e3a5f] text-white text-sm rounded-lg hover:bg-[#162d4a] transition-colors disabled:opacity-50"
                    >
                      {loading ? "Creando..." : `Crear ${labels[type].toLowerCase()}`}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Created entities */}
      {created.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Creado en esta sesión
          </p>
          <div className="space-y-1.5">
            {created.map((e, i) => {
              const icons = { task: CheckSquare, project: Briefcase, objective: Target };
              const Icon = icons[e.type];
              return (
                <Link
                  key={i}
                  href={entityUrl(e)}
                  className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs hover:bg-emerald-100 transition-colors"
                >
                  <Icon className="w-3 h-3 flex-shrink-0" />
                  <span className="flex-1 truncate">{entityLabel(e)}</span>
                  <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-50" />
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
