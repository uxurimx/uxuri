"use client";

import { cn, formatDate } from "@/lib/utils";
import { Flag, Pencil, Trash2, User } from "lucide-react";
import type { TaskWithProject } from "./kanban-board";

type UserType = { id: string; name: string | null };

const statusConfig = {
  todo:        { label: "Por hacer",   className: "bg-slate-100 text-slate-600" },
  in_progress: { label: "En progreso", className: "bg-blue-50 text-blue-700" },
  review:      { label: "Revisión",    className: "bg-purple-50 text-purple-700" },
  done:        { label: "Hecho",       className: "bg-emerald-50 text-emerald-700" },
};

const priorityConfig = {
  low:    { label: "Baja",    color: "text-slate-400" },
  medium: { label: "Media",   color: "text-amber-500" },
  high:   { label: "Alta",    color: "text-orange-500" },
  urgent: { label: "Urgente", color: "text-red-500" },
};

const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };

function getStaleness(updatedAt: Date, status: TaskWithProject["status"]) {
  if (status === "done") return null;
  const diffDays = (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 1) return null;
  const days = Math.floor(diffDays);
  return { level: diffDays < 3 ? "warn" : "alert", days } as const;
}

interface TaskListViewProps {
  tasks: TaskWithProject[];
  currentUserId?: string;
  users?: UserType[];
  onView: (task: TaskWithProject) => void;
  onEdit: (task: TaskWithProject) => void;
  onDelete: (taskId: string) => void;
  deletingId: string | null;
}

export function TaskListView({
  tasks, currentUserId, users, onView, onEdit, onDelete, deletingId,
}: TaskListViewProps) {
  const sorted = [...tasks].sort((a, b) => {
    const pa = priorityOrder[a.priority] ?? 99;
    const pb = priorityOrder[b.priority] ?? 99;
    if (pa !== pb) return pa - pb;
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });

  if (sorted.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-200">
        No hay tareas que mostrar
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Tarea</th>
            <th className="px-4 py-3">Prioridad</th>
            <th className="px-4 py-3 hidden md:table-cell">Proyecto</th>
            <th className="px-4 py-3 hidden lg:table-cell">Asignado</th>
            <th className="px-4 py-3 hidden md:table-cell">Fecha</th>
            <th className="px-4 py-3 w-20"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((task) => {
            const status = statusConfig[task.status];
            const priority = priorityConfig[task.priority];
            const isOwner = !task.createdBy || task.createdBy === currentUserId;
            const assignedUser = users?.find((u) => u.id === task.assignedTo);
            const creatorName = task.createdBy
              ? (users?.find((u) => u.id === task.createdBy)?.name ?? null)
              : null;
            const staleness = getStaleness(task.updatedAt, task.status);

            const effectiveStatus = task.personalDone ? statusConfig.done : status;

            return (
              <tr
                key={task.id}
                onClick={() => onView(task)}
                className={cn("hover:bg-slate-50 cursor-pointer transition-colors", task.personalDone && "opacity-60")}
              >
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap", effectiveStatus.className)}>
                      {effectiveStatus.label}
                    </span>
                    {task.personalDone && (
                      <span className="text-[10px] text-emerald-600 font-medium">✓ hecho para ti</span>
                    )}
                  </div>
                </td>

                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900 line-clamp-1">{task.title}</p>
                  {creatorName && (
                    <p className="flex items-center gap-0.5 text-xs text-slate-400 mt-0.5">
                      <User className="w-3 h-3 flex-shrink-0" />
                      {creatorName}
                    </p>
                  )}
                </td>

                <td className="px-4 py-3">
                  <span className={cn("flex items-center gap-1 text-xs font-medium", priority.color)}>
                    <Flag className="w-3 h-3" />
                    {priority.label}
                  </span>
                  {staleness && (
                    <span
                      title={`Sin movimiento hace ${staleness.days} día${staleness.days !== 1 ? "s" : ""}`}
                      className="flex items-center gap-0.5 mt-1"
                    >
                      <span className={cn(
                        "inline-block w-1.5 h-1.5 rounded-full flex-shrink-0",
                        staleness.level === "warn" ? "bg-amber-400" : "bg-red-500 animate-pulse"
                      )} />
                      <span className={cn(
                        "text-[10px] font-semibold tabular-nums",
                        staleness.level === "warn" ? "text-amber-500" : "text-red-500"
                      )}>
                        {staleness.days}d sin mov.
                      </span>
                    </span>
                  )}
                </td>

                <td className="px-4 py-3 hidden md:table-cell text-xs text-slate-500">
                  {task.projectName ?? "—"}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-xs text-slate-500">
                  {assignedUser?.name ?? (task.assignedTo ? "Usuario" : "—")}
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-xs text-slate-400">
                  {task.dueDate ? formatDate(task.dueDate) : "—"}
                </td>
                <td className="px-4 py-3">
                  {isOwner && (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onEdit(task)}
                        className="p-1 rounded text-slate-400 hover:text-[#1e3a5f] hover:bg-slate-100 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDelete(task.id)}
                        disabled={deletingId === task.id}
                        className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
