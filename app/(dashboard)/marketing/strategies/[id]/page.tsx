import { db } from "@/db";
import { mktStrategies, mktCampaigns, mktCopies, mktLeads, users } from "@/db/schema";
import { eq, count, and, ne } from "drizzle-orm";
import { requireAccess } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Target, Zap, Users, TrendingUp, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  draft:     { label: "Borrador",   className: "bg-slate-100 text-slate-600" },
  active:    { label: "Activa",     className: "bg-emerald-50 text-emerald-700" },
  paused:    { label: "Pausada",    className: "bg-amber-50 text-amber-700" },
  completed: { label: "Completada", className: "bg-blue-50 text-blue-700" },
  queued:    { label: "En cola",    className: "bg-amber-50 text-amber-700" },
  running:   { label: "Ejecutando", className: "bg-emerald-50 text-emerald-700" },
  failed:    { label: "Fallida",    className: "bg-red-50 text-red-700" },
} as const;

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp", email: "Email", ig_dm: "Instagram DM",
  whatsapp_email: "WhatsApp + Email", sms: "SMS", other: "Otro",
};

export default async function StrategyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAccess("/marketing");
  const { id } = await params;

  // Evitar query con id inválido (ej. "new" desde links incorrectos)
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(id)) notFound();

  const [strategy] = await db
    .select()
    .from(mktStrategies)
    .where(eq(mktStrategies.id, id));

  if (!strategy) notFound();

  const [campaigns, totalLeads, leadsInteresados, leadsCerrados] = await Promise.all([
    db.select().from(mktCampaigns).where(eq(mktCampaigns.strategyId, id)),
    db.select({ total: count() }).from(mktLeads).where(eq(mktLeads.strategyId, id)),
    db.select({ total: count() }).from(mktLeads).where(and(eq(mktLeads.strategyId, id), eq(mktLeads.status, "interesado"))),
    db.select({ total: count() }).from(mktLeads).where(and(eq(mktLeads.strategyId, id), eq(mktLeads.status, "cerrado"))),
  ]);

  // Copies disponibles para las campañas
  const copyIds = campaigns.map((c) => c.copyId).filter(Boolean) as string[];
  const workerIds = campaigns.map((c) => c.assignedTo).filter(Boolean) as string[];

  const [copiesMap, workersMap] = await Promise.all([
    copyIds.length
      ? db.select({ id: mktCopies.id, title: mktCopies.title, abVariant: mktCopies.abVariant })
          .from(mktCopies)
          .then((rows) => Object.fromEntries(rows.filter((r) => copyIds.includes(r.id)).map((r) => [r.id, r])))
      : Promise.resolve({} as Record<string, { id: string; title: string; abVariant: string | null }>),
    workerIds.length
      ? db.select({ id: users.id, name: users.name })
          .from(users)
          .then((rows) => Object.fromEntries(rows.filter((r) => workerIds.includes(r.id)).map((r) => [r.id, r])))
      : Promise.resolve({} as Record<string, { id: string; name: string | null }>),
  ]);

  const sc = STATUS_CONFIG[strategy.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.draft;
  const totalLeadsCount = totalLeads[0]?.total ?? 0;
  const interestedCount = leadsInteresados[0]?.total ?? 0;
  const closedCount = leadsCerrados[0]?.total ?? 0;
  const convRate = totalLeadsCount > 0 ? Math.round((closedCount / totalLeadsCount) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/marketing" className="hover:text-slate-700">Marketing</Link>
        <span>/</span>
        <Link href="/marketing/strategies" className="hover:text-slate-700">Estrategias</Link>
        <span>/</span>
        <span className="text-slate-800 font-medium truncate">{strategy.title}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1e3a5f]/10 flex items-center justify-center shrink-0">
              <Target className="w-5 h-5 text-[#1e3a5f]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{strategy.title}</h1>
              {strategy.description && (
                <p className="text-slate-500 text-sm mt-1">{strategy.description}</p>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", sc.className)}>{sc.label}</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600">
                  {CHANNEL_LABELS[strategy.channel] ?? strategy.channel}
                </span>
                {strategy.targetNiche && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-50 text-indigo-700">
                    {strategy.targetNiche}
                  </span>
                )}
                {strategy.targetCity && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    📍 {strategy.targetCity}{strategy.targetCountry !== "México" ? `, ${strategy.targetCountry}` : ""}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Link
            href="/marketing/strategies"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>

        {strategy.productOffered && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">Producto ofrecido</p>
            <p className="text-sm text-slate-800">{strategy.productOffered}</p>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Leads totales", value: totalLeadsCount, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Interesados", value: interestedCount, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Cerrados", value: closedCount, icon: Target, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "Conversión", value: `${convRate}%`, icon: TrendingUp, color: "text-amber-600", bg: "bg-amber-50" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-lg ${stat.bg}`}>
                <stat.icon className={`w-3.5 h-3.5 ${stat.color}`} />
              </div>
              <span className="text-xs text-slate-500">{stat.label}</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Campañas */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-500" />
            Campañas ({campaigns.length})
          </h2>
          <Link
            href={`/marketing/campaigns`}
            className="flex items-center gap-1 text-xs text-[#1e3a5f] hover:underline"
          >
            <Plus className="w-3.5 h-3.5" />
            Nueva campaña
          </Link>
        </div>
        {campaigns.length === 0 ? (
          <div className="px-5 py-10 text-center text-slate-400 text-sm">
            No hay campañas para esta estrategia aún.
            <br />
            <Link href="/marketing/campaigns" className="text-[#1e3a5f] hover:underline mt-2 inline-block">
              Crear primera campaña →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {campaigns.map((c) => {
              const csc = STATUS_CONFIG[c.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.draft;
              const copy = c.copyId ? copiesMap[c.copyId] : null;
              const worker = c.assignedTo ? workersMap[c.assignedTo] : null;
              const respRate = c.contacted > 0 ? Math.round((c.responded / c.contacted) * 100) : 0;
              return (
                <Link key={c.id} href={`/marketing/campaigns/${c.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-slate-800 group-hover:text-[#1e3a5f] transition-colors line-clamp-1">{c.title}</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium shrink-0", csc.className)}>{csc.label}</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {copy ? `✉️ ${copy.title}${copy.abVariant ? ` (${copy.abVariant})` : ""}` : "Sin copy"}
                      {worker ? ` · 👤 ${worker.name}` : ""}
                      {` · ${c.contacted} contactados · ${respRate}% resp.`}
                    </div>
                  </div>
                  <span className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0">→</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Notas */}
      {strategy.notes && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
          <p className="text-xs font-medium text-amber-700 mb-1">Notas</p>
          <p className="text-sm text-amber-900 whitespace-pre-wrap">{strategy.notes}</p>
        </div>
      )}
    </div>
  );
}
