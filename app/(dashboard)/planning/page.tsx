import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { planningSessions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { Zap, Plus } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { PlanningList } from "@/components/planning/planning-list";

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
        <PlanningList
          initialSessions={sessions.map((s) => ({
            id: s.id,
            title: s.title,
            contextType: s.contextType,
            status: s.status,
            updatedAt: formatDateTime(s.updatedAt.toISOString()),
          }))}
        />
      )}
    </div>
  );
}
