import { db } from "@/db";
import { mktCampaigns, mktStrategies, mktCopies, mktLeads, users } from "@/db/schema";
import { eq, count, and } from "drizzle-orm";
import { requireAccess } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Zap, Users, TrendingUp, MessageSquare, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  draft:     { label: "Borrador",   className: "bg-slate-100 text-slate-600" },
  queued:    { label: "En cola",    className: "bg-amber-50 text-amber-700" },
  running:   { label: "Activa",     className: "bg-emerald-50 text-emerald-700" },
  completed: { label: "Completada", className: "bg-blue-50 text-blue-700" },
  paused:    { label: "Pausada",    className: "bg-slate-100 text-slate-600" },
  failed:    { label: "Fallida",    className: "bg-red-50 text-red-700" },
} as const;

function renderPreview(content: string, niche: string, city: string): string {
  return content
    .replace(/\{nombre\}/g, "Negocio Ejemplo")
    .replace(/\{ciudad\}/g, city || "CDMX")
    .replace(/\{nicho\}/g, niche || "cliente")
    .replace(/\{plataforma\}/g, "propio");
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAccess("/marketing");
  const { id } = await params;

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(id)) notFound();

  const [campaign] = await db
    .select()
    .from(mktCampaigns)
    .where(eq(mktCampaigns.id, id));

  if (!campaign) notFound();

  const [strategy, copy, worker] = await Promise.all([
    campaign.strategyId
      ? db.select().from(mktStrategies).where(eq(mktStrategies.id, campaign.strategyId)).then((r) => r[0] ?? null)
      : Promise.resolve(null),
    campaign.copyId
      ? db.select().from(mktCopies).where(eq(mktCopies.id, campaign.copyId)).then((r) => r[0] ?? null)
      : Promise.resolve(null),
    campaign.assignedTo
      ? db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, campaign.assignedTo)).then((r) => r[0] ?? null)
      : Promise.resolve(null),
  ]);

  // Leads breakdown
  const [totalDB, contactadosDB, interesadosDB, cerradosDB, sinWaDB] = await Promise.all([
    db.select({ total: count() }).from(mktLeads).where(eq(mktLeads.campaignId, id)),
    db.select({ total: count() }).from(mktLeads).where(and(eq(mktLeads.campaignId, id), eq(mktLeads.status, "contactado"))),
    db.select({ total: count() }).from(mktLeads).where(and(eq(mktLeads.campaignId, id), eq(mktLeads.status, "interesado"))),
    db.select({ total: count() }).from(mktLeads).where(and(eq(mktLeads.campaignId, id), eq(mktLeads.status, "cerrado"))),
    db.select({ total: count() }).from(mktLeads).where(and(eq(mktLeads.campaignId, id), eq(mktLeads.status, "sin_whatsapp"))),
  ]);

  const sc = STATUS_CONFIG[campaign.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.draft;
  const totalLeadsCount = totalDB[0]?.total ?? 0;
  const contactadosCount = contactadosDB[0]?.total ?? 0;
  const interesadosCount = interesadosDB[0]?.total ?? 0;
  const cerradosCount = cerradosDB[0]?.total ?? 0;
  const sinWaCount = sinWaDB[0]?.total ?? 0;
  const respRate = contactadosCount > 0 ? Math.round(((campaign.responded ?? 0) / contactadosCount) * 100) : 0;
  const convRate = totalLeadsCount > 0 ? Math.round((cerradosCount / totalLeadsCount) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/marketing" className="hover:text-slate-700">Marketing</Link>
        <span>/</span>
        <Link href="/marketing/campaigns" className="hover:text-slate-700">Campañas</Link>
        <span>/</span>
        <span className="text-slate-800 font-medium truncate">{campaign.title}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1e3a5f]/10 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-[#1e3a5f]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{campaign.title}</h1>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", sc.className)}>{sc.label}</span>
                {worker && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">👤 {worker.name}</span>
                )}
                {campaign.scheduledAt && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                    🕐 {new Date(campaign.scheduledAt).toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Link href="/marketing/campaigns" className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>

        {/* Estrategia vinculada */}
        {strategy && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">Estrategia</p>
            <Link href={`/marketing/strategies/${strategy.id}`} className="text-sm text-[#1e3a5f] hover:underline font-medium">
              {strategy.title}
            </Link>
            {(strategy.targetNiche || strategy.targetCity) && (
              <span className="text-xs text-slate-400 ml-2">
                — {[strategy.targetNiche, strategy.targetCity].filter(Boolean).join(", ")}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Funnel de métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Leads totales", value: totalLeadsCount, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Contactados", value: contactadosCount, icon: MessageSquare, color: "text-yellow-600", bg: "bg-yellow-50" },
          { label: "Interesados", value: interesadosCount, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Cerrados", value: cerradosCount, icon: CheckCircle2, color: "text-purple-600", bg: "bg-purple-50" },
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

      {/* Tasas */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Tasa de respuesta</p>
          <p className="text-3xl font-bold text-slate-900">{respRate}%</p>
          <div className="mt-2 h-1.5 bg-slate-100 rounded-full">
            <div className="h-1.5 bg-blue-500 rounded-full" style={{ width: `${Math.min(respRate, 100)}%` }} />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">Tasa de conversión</p>
          <p className="text-3xl font-bold text-slate-900">{convRate}%</p>
          <div className="mt-2 h-1.5 bg-slate-100 rounded-full">
            <div className="h-1.5 bg-purple-500 rounded-full" style={{ width: `${Math.min(convRate, 100)}%` }} />
          </div>
        </div>
      </div>

      {/* Copy usado */}
      {copy && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800">Copy asignado</h3>
            {copy.abVariant && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 font-medium">
                Variante {copy.abVariant}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 font-medium mb-2">{copy.title}</p>
          <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
            {renderPreview(copy.content, strategy?.targetNiche ?? "", strategy?.targetCity ?? "")}
          </div>
          <p className="text-xs text-slate-400 mt-2">Preview con datos de ejemplo. Variables reales se reemplazan al enviar.</p>
        </div>
      )}

      {/* Sin WhatsApp / Extras */}
      {sinWaCount > 0 && (
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 text-sm text-orange-800">
          <span className="font-medium">{sinWaCount}</span> leads sin WhatsApp detectado en esta campaña.
        </div>
      )}

      {/* Leads (Phase 3 placeholder) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Leads de esta campaña</h3>
          <Link href={`/marketing/leads?campaignId=${id}`} className="text-xs text-[#1e3a5f] hover:underline">
            Ver todos →
          </Link>
        </div>
        <p className="text-sm text-slate-400 mt-2">
          {totalLeadsCount > 0
            ? `${totalLeadsCount} leads vinculados. La tabla detallada estará disponible en la Fase 3.`
            : "Sin leads vinculados todavía. Los leads se crean cuando el worker sincroniza desde la app de scraping."}
        </p>
      </div>

      {/* Notas */}
      {campaign.notes && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
          <p className="text-xs font-medium text-amber-700 mb-1">Notas</p>
          <p className="text-sm text-amber-900 whitespace-pre-wrap">{campaign.notes}</p>
        </div>
      )}
    </div>
  );
}
