import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { planningSessions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { Zap, Plus, Archive } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

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

export default async function PlanningPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const sessions = await db
    .select()
    .from(planningSessions)
    .where(eq(planningSessions.createdBy, userId))
    .orderBy(desc(planningSessions.updatedAt));

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Zap className="w-6 h-6 text-[#1e3a5f]" />
            Planificación
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Captura ideas, reduce incertidumbre y convierte en acción con NEXUS
          </p>
        </div>
        <Link
          href="/planning/new"
          className="flex items-center gap-2 px-4 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#162d4a] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva sesión
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Zap className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">Sin sesiones de planificación</p>
          <p className="text-sm mt-1">Inicia una nueva sesión para trabajar con NEXUS</p>
          <Link
            href="/planning/new"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm hover:bg-[#162d4a] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Comenzar
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <Link
              key={s.id}
              href={`/planning/${s.id}`}
              className="block p-4 bg-white border border-slate-200 rounded-xl hover:border-[#1e3a5f]/30 hover:shadow-sm transition-all group"
            >
              <div className="flex items-start justify-between gap-4">
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
                  <h3 className="font-semibold text-slate-900 group-hover:text-[#1e3a5f] transition-colors truncate">
                    {s.title}
                  </h3>
                </div>
                <span className="text-xs text-slate-400 flex-shrink-0">
                  {formatDateTime(s.updatedAt.toISOString())}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
