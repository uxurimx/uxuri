"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Project = { id: string; name: string };

type CreatedTask = {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: string | null;
  projectId: string | null;
  agentId: string | null;
};

interface QuickAddTaskProps {
  agentId?: string;
  projectId?: string;
  projects?: Project[];
  onAdd: (task: CreatedTask) => void;
  placeholder?: string;
}

const PRIORITY_OPTIONS = [
  { value: "low",    label: "Baja",    dot: "bg-slate-300" },
  { value: "medium", label: "Media",   dot: "bg-amber-400" },
  { value: "high",   label: "Alta",    dot: "bg-orange-400" },
  { value: "urgent", label: "Urgente", dot: "bg-red-500" },
] as const;

export function QuickAddTask({
  agentId,
  projectId: defaultProjectId,
  projects = [],
  onAdd,
  placeholder = "Nueva tarea…",
}: QuickAddTaskProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [selectedProjectId, setSelectedProjectId] = useState(defaultProjectId ?? "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function handleCancel() {
    setOpen(false);
    setTitle("");
    setPriority("medium");
    setSelectedProjectId(defaultProjectId ?? "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          priority,
          projectId: selectedProjectId || null,
          agentId: agentId || null,
          status: "todo",
        }),
      });
      if (!res.ok) return;
      const task: CreatedTask = await res.json();
      onAdd(task);
      setTitle("");
      setPriority("medium");
      // keep open so user can add more tasks quickly
      inputRef.current?.focus();
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-slate-300 text-slate-400 hover:border-[#1e3a5f] hover:text-[#1e3a5f] transition-colors text-sm group"
      >
        <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
        {placeholder}
      </button>
    );
  }

  const selectedPriority = PRIORITY_OPTIONS.find((p) => p.value === priority)!;

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl border border-[#1e3a5f]/30 shadow-sm overflow-hidden"
    >
      <div className="p-3">
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && handleCancel()}
          placeholder={placeholder}
          className="w-full text-sm font-medium text-slate-900 placeholder:text-slate-300 focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-2 px-3 pb-3 pt-1 border-t border-slate-100 flex-wrap">
        {/* Priority picker */}
        <div className="relative group">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 text-xs text-slate-600 hover:border-slate-300 transition-colors"
          >
            <span className={cn("w-2 h-2 rounded-full", selectedPriority.dot)} />
            {selectedPriority.label}
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>
          <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 hidden group-focus-within:block min-w-[110px]">
            {PRIORITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPriority(opt.value)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-slate-50 transition-colors",
                  priority === opt.value && "font-semibold text-[#1e3a5f]"
                )}
              >
                <span className={cn("w-2 h-2 rounded-full flex-shrink-0", opt.dot)} />
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Project picker (only if multiple projects available) */}
        {projects.length > 0 && (
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1 text-slate-600 focus:outline-none focus:border-[#1e3a5f] bg-white max-w-[160px]"
          >
            <option value="">Sin proyecto</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCancel}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <button
            type="submit"
            disabled={!title.trim() || saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1e3a5f] text-white rounded-lg text-xs font-medium hover:bg-[#162d4a] transition-colors disabled:opacity-40"
          >
            {saving ? "Guardando…" : "Agregar"}
          </button>
        </div>
      </div>
    </form>
  );
}
