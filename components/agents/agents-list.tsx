"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

const EMOJIS = [
  "🤖", "💻", "🎨", "📊", "✍️", "🔍",
  "⚡", "🧠", "🎯", "📱", "🔧", "🌐",
  "👔", "🔬", "📐", "🎭", "🚀", "💡",
  "🔑", "🎪",
];

const COLORS = [
  { value: "#1e3a5f", label: "Azul" },
  { value: "#7c3aed", label: "Violeta" },
  { value: "#059669", label: "Esmeralda" },
  { value: "#d97706", label: "Ámbar" },
  { value: "#dc2626", label: "Rojo" },
  { value: "#0891b2", label: "Cian" },
  { value: "#be185d", label: "Rosa" },
  { value: "#374151", label: "Gris" },
  { value: "#9333ea", label: "Púrpura" },
  { value: "#0d9488", label: "Verde" },
];

const schema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  specialty: z.string().optional(),
  description: z.string().optional(),
  avatar: z.string().default("🤖"),
  color: z.string().default("#1e3a5f"),
});

type FormData = z.infer<typeof schema>;

export type AgentWithCount = {
  id: string;
  name: string;
  specialty: string | null;
  description: string | null;
  avatar: string;
  color: string;
  createdBy: string | null;
  taskCount: number;
};

// ── Agent Card ────────────────────────────────────────────────────────────────

function AgentCard({
  agent,
  currentUserId,
  onEdit,
  onDelete,
}: {
  agent: AgentWithCount;
  currentUserId: string;
  onEdit: (agent: AgentWithCount) => void;
  onDelete: (id: string) => void;
}) {
  const isOwner = !agent.createdBy || agent.createdBy === currentUserId;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-sm transition-shadow group">
      <div className="h-1.5" style={{ backgroundColor: agent.color }} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{ backgroundColor: agent.color + "18" }}
          >
            {agent.avatar}
          </div>
          {isOwner && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onEdit(agent)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-[#1e3a5f] hover:bg-slate-100 transition-colors"
                title="Editar"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDelete(agent.id)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                title="Eliminar"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        <h3 className="font-semibold text-slate-900 text-base leading-snug">{agent.name}</h3>
        {agent.specialty && (
          <p className="text-xs text-slate-400 mt-0.5">{agent.specialty}</p>
        )}
        {agent.description && (
          <p className="text-sm text-slate-500 mt-2 line-clamp-2 leading-relaxed">{agent.description}</p>
        )}

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {agent.taskCount === 0
              ? "Sin tareas activas"
              : agent.taskCount === 1
              ? "1 tarea activa"
              : `${agent.taskCount} tareas activas`}
          </span>
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: agent.color }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Agent Modal (create / edit) ───────────────────────────────────────────────

function AgentModal({
  open,
  onClose,
  editAgent,
}: {
  open: boolean;
  onClose: () => void;
  editAgent?: AgentWithCount | null;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { avatar: "🤖", color: "#1e3a5f" },
  });

  const selectedAvatar = watch("avatar");
  const selectedColor = watch("color");

  useEffect(() => {
    if (!open) return;
    if (editAgent) {
      reset({
        name: editAgent.name,
        specialty: editAgent.specialty ?? "",
        description: editAgent.description ?? "",
        avatar: editAgent.avatar,
        color: editAgent.color,
      });
    } else {
      reset({ name: "", specialty: "", description: "", avatar: "🤖", color: "#1e3a5f" });
    }
  }, [open, editAgent, reset]);

  async function onSubmit(data: FormData) {
    setIsLoading(true);
    try {
      const url = editAgent ? `/api/agents/${editAgent.id}` : "/api/agents";
      const method = editAgent ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        onClose();
        router.refresh();
      }
    } finally {
      setIsLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">
            {editAgent ? "Editar agente" : "Nuevo agente"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
            <input
              {...register("name")}
              autoFocus
              placeholder="ej. Dev, Diseñador, Estratega"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
            />
            {errors.name && (
              <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>
            )}
          </div>

          {/* Specialty */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Especialidad</label>
            <input
              {...register("specialty")}
              placeholder="ej. Desarrollo de Software, Marketing Digital"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
            <textarea
              {...register("description")}
              rows={2}
              placeholder="¿Cómo piensa este agente? ¿Qué hace?"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 resize-none"
            />
          </div>

          {/* Avatar picker */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Avatar</label>
            <div className="grid grid-cols-10 gap-1">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setValue("avatar", emoji)}
                  className={cn(
                    "w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-all",
                    selectedAvatar === emoji
                      ? "bg-[#1e3a5f]/10 ring-2 ring-[#1e3a5f]/30"
                      : "hover:bg-slate-100"
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Color picker */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Color</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setValue("color", c.value)}
                  title={c.label}
                  className={cn(
                    "w-7 h-7 rounded-full transition-transform",
                    selectedColor === c.value
                      ? "scale-125 ring-2 ring-offset-2 ring-slate-400"
                      : "hover:scale-110"
                  )}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-3 border border-slate-100">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ backgroundColor: selectedColor + "20" }}
            >
              {selectedAvatar}
            </div>
            <div>
              <div className="h-2 w-16 rounded-full mb-1.5" style={{ backgroundColor: selectedColor + "40" }} />
              <div className="h-1.5 w-10 rounded-full bg-slate-200" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#162d4a] transition-colors disabled:opacity-50"
            >
              {isLoading ? "Guardando..." : editAgent ? "Guardar" : "Crear agente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Agents List (main export) ─────────────────────────────────────────────────

export function AgentsList({
  initialAgents,
  currentUserId,
}: {
  initialAgents: AgentWithCount[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [agentsList, setAgentsList] = useState(initialAgents);
  const [modalOpen, setModalOpen] = useState(false);
  const [editAgent, setEditAgent] = useState<AgentWithCount | null>(null);

  function openCreate() {
    setEditAgent(null);
    setModalOpen(true);
  }

  function openEdit(agent: AgentWithCount) {
    setEditAgent(agent);
    setModalOpen(true);
  }

  function handleClose() {
    setModalOpen(false);
    setEditAgent(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este agente? Las tareas asignadas quedarán sin agente.")) return;
    setAgentsList((prev) => prev.filter((a) => a.id !== id));
    await fetch(`/api/agents/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Agentes</h1>
          <p className="text-slate-500 text-sm mt-1">
            Personas virtuales para organizar roles y delegar tareas
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 bg-[#1e3a5f] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#162d4a] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo agente
        </button>
      </div>

      {/* Empty state */}
      {agentsList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-4 text-4xl">
            🤖
          </div>
          <h3 className="font-semibold text-slate-900 mb-1 text-lg">Sin agentes aún</h3>
          <p className="text-sm text-slate-500 max-w-xs mb-6 leading-relaxed">
            Crea agentes para dividir roles mentales y delegar tareas a identidades virtuales. En el futuro, cada agente puede conectarse a IA.
          </p>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 bg-[#1e3a5f] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#162d4a] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Crear primer agente
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {agentsList.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              currentUserId={currentUserId}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <AgentModal open={modalOpen} onClose={handleClose} editAgent={editAgent} />
    </>
  );
}
