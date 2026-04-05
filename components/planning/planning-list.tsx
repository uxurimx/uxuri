"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Archive, Pencil, Trash2, Check, X } from "lucide-react";

const contextTypeLabel: Record<string, string> = {
  blank: "Sesión libre",
  task: "Tarea",
  project: "Proyecto",
  objective: "Objetivo",
  client: "Cliente",
};

const contextTypeBadge: Record<string, string> = {
  blank: "bg-slate-100 text-slate-600",
  task: "bg-blue-50 text-blue-700",
  project: "bg-violet-50 text-violet-700",
  objective: "bg-amber-50 text-amber-700",
  client: "bg-emerald-50 text-emerald-700",
};

interface Session {
  id: string;
  title: string;
  contextType: string;
  status: string;
  updatedAt: string;
}

export function PlanningList({ initialSessions }: { initialSessions: Session[] }) {
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function startRename(s: Session) {
    setRenamingId(s.id);
    setRenameValue(s.title);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function confirmRename(id: string) {
    const trimmed = renameValue.trim();
    if (!trimmed) { setRenamingId(null); return; }
    const res = await fetch(`/api/planning/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });
    if (res.ok) {
      setSessions((prev) => prev.map((s) => s.id === id ? { ...s, title: trimmed } : s));
    }
    setRenamingId(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta sesión de planificación? Se perderán todos los mensajes.")) return;
    const res = await fetch(`/api/planning/${id}`, { method: "DELETE" });
    if (res.ok) setSessions((prev) => prev.filter((s) => s.id !== id));
  }

  if (sessions.length === 0) return null;

  return (
    <div className="space-y-3">
      {sessions.map((s) => (
        <div
          key={s.id}
          className="flex items-start gap-4 p-4 bg-white border border-slate-200 rounded-xl hover:border-[#1e3a5f]/30 hover:shadow-sm transition-all group"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${contextTypeBadge[s.contextType] ?? contextTypeBadge.blank}`}>
                {contextTypeLabel[s.contextType] ?? s.contextType}
              </span>
              {s.status === "archived" && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Archive className="w-3 h-3" />
                  Archivada
                </span>
              )}
            </div>

            {renamingId === s.id ? (
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmRename(s.id);
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                  className="flex-1 text-sm font-semibold border border-[#1e3a5f]/30 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                />
                <button onClick={() => confirmRename(s.id)} className="p-1 text-emerald-600 hover:text-emerald-700">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => setRenamingId(null)} className="p-1 text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link href={`/planning/${s.id}`}>
                <h3 className="font-semibold text-slate-900 group-hover:text-[#1e3a5f] transition-colors truncate">
                  {s.title}
                </h3>
              </Link>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs text-slate-400 mr-2">{s.updatedAt}</span>
            <button
              onClick={() => startRename(s)}
              title="Renombrar"
              className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-slate-100 text-slate-400 hover:text-[#1e3a5f] transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleDelete(s.id)}
              title="Eliminar"
              className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
