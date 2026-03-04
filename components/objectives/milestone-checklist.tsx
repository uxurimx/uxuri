"use client";

import { useState } from "react";
import { Plus, Trash2, Calendar } from "lucide-react";

interface Milestone {
  id: string;
  title: string;
  done: boolean;
  dueDate?: string;
  sortOrder: number | null;
}

interface MilestoneChecklistProps {
  objectiveId: string;
  initialMilestones: Milestone[];
  onProgressChange?: () => void;
}

export function MilestoneChecklist({
  objectiveId,
  initialMilestones,
  onProgressChange,
}: MilestoneChecklistProps) {
  const [milestones, setMilestones] = useState<Milestone[]>(initialMilestones);
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [adding, setAdding] = useState(false);

  async function toggleDone(milestone: Milestone) {
    const updated = { ...milestone, done: !milestone.done };
    setMilestones((prev) => prev.map((m) => (m.id === milestone.id ? updated : m)));

    await fetch(`/api/objectives/${objectiveId}/milestones/${milestone.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !milestone.done }),
    });
    onProgressChange?.();
  }

  async function addMilestone(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/objectives/${objectiveId}/milestones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmed,
          dueDate: newDueDate || undefined,
          sortOrder: milestones.length,
        }),
      });
      if (res.ok) {
        const milestone = await res.json();
        setMilestones((prev) => [...prev, milestone]);
        setNewTitle("");
        setNewDueDate("");
      }
    } finally {
      setAdding(false);
    }
  }

  async function deleteMilestone(id: string) {
    setMilestones((prev) => prev.filter((m) => m.id !== id));
    await fetch(`/api/objectives/${objectiveId}/milestones/${id}`, { method: "DELETE" });
    onProgressChange?.();
  }

  const done = milestones.filter((m) => m.done).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">
          {done} / {milestones.length} completados
        </span>
      </div>

      <div className="space-y-2">
        {milestones.map((m) => (
          <div
            key={m.id}
            className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors group"
          >
            <input
              type="checkbox"
              checked={m.done}
              onChange={() => toggleDone(m)}
              className="w-4 h-4 accent-[#1e3a5f] flex-shrink-0"
            />
            <span
              className={`flex-1 text-sm ${
                m.done ? "line-through text-slate-400" : "text-slate-700"
              }`}
            >
              {m.title}
            </span>
            {m.dueDate && (
              <span className="text-xs px-2 py-1 bg-slate-100 rounded text-slate-600 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(m.dueDate).toLocaleDateString("es-MX")}
              </span>
            )}
            <button
              onClick={() => deleteMilestone(m.id)}
              className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Add milestone */}
      <form onSubmit={addMilestone} className="space-y-2">
        <div className="flex gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Nuevo hito..."
            className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
          />
          <input
            type="date"
            value={newDueDate}
            onChange={(e) => setNewDueDate(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
          />
          <button
            type="submit"
            disabled={adding || !newTitle.trim()}
            className="flex items-center gap-1 px-3 py-1.5 bg-[#1e3a5f] text-white rounded-lg text-sm hover:bg-[#162d4a] transition-colors disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            Añadir
          </button>
        </div>
      </form>
    </div>
  );
}
