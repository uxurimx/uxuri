"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { TaskModal } from "./task-modal";

export function TasksHeader() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tareas</h1>
          <p className="text-slate-500 text-sm mt-1">Tablero kanban de todas las tareas</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 bg-[#1e3a5f] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#162d4a] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva tarea
        </button>
      </div>
      <TaskModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
