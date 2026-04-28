"use client";

import Link from "next/link";
import { Target, Pin, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

type PinnedObjective = {
  id: string;
  title: string;
  status: string;
  priority: string;
  overallProgress: number;
};

const statusConfig: Record<string, { label: string; className: string }> = {
  draft:     { label: "Borrador",  className: "bg-slate-100 text-slate-500" },
  active:    { label: "Activo",    className: "bg-emerald-50 text-emerald-700" },
  paused:    { label: "Pausado",   className: "bg-amber-50 text-amber-700" },
  completed: { label: "Completo",  className: "bg-blue-50 text-blue-700" },
  cancelled: { label: "Cancelado", className: "bg-red-50 text-red-700" },
};

export function PinnedObjectivesWidget({ objectives }: { objectives: PinnedObjective[] }) {
  const router = useRouter();
  const [unpinning, setUnpinning] = useState<string | null>(null);

  async function handleUnpin(id: string) {
    setUnpinning(id);
    try {
      await fetch(`/api/objectives/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinnedToDashboard: false }),
      });
      router.refresh();
    } finally {
      setUnpinning(null);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-4 h-4 text-slate-400" />
        <h3 className="font-semibold text-slate-800 text-sm">Objetivos principales</h3>
      </div>

      {objectives.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-6 text-center">
          <p className="text-sm text-slate-400">Sin objetivos fijados.</p>
          <Link
            href="/objectives"
            className="mt-2 text-xs text-[#1e3a5f] hover:underline"
          >
            Ir a Objetivos para fijar uno →
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {objectives.map((obj) => {
            const sc = statusConfig[obj.status] ?? statusConfig.draft;
            return (
              <li key={obj.id} className="group">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/objectives/${obj.id}`}
                    className="flex-1 min-w-0"
                  >
                    <p className="text-sm font-medium text-slate-700 truncate hover:text-[#1e3a5f] transition-colors">
                      {obj.title}
                    </p>
                  </Link>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", sc.className)}>
                      {sc.label}
                    </span>
                    <button
                      onClick={() => handleUnpin(obj.id)}
                      disabled={unpinning === obj.id}
                      title="Desfijar del dashboard"
                      className="p-1 text-slate-300 hover:text-slate-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Pin className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--skin-progress-track)" }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${obj.overallProgress}%`, backgroundColor: "var(--skin-progress-bar)" }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 tabular-nums w-8 text-right">
                    {obj.overallProgress}%
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {objectives.length > 0 && (
        <Link
          href="/objectives"
          className="mt-4 flex items-center gap-1 text-xs text-slate-400 hover:text-[#1e3a5f] transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Ver todos los objetivos
        </Link>
      )}
    </div>
  );
}
