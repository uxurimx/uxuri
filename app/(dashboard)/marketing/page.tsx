import { db } from "@/db";
import { mktLeads, mktCampaigns, mktStrategies, mktInteractions, mktWorkers } from "@/db/schema";
import { eq, count, desc, gte, and, sql } from "drizzle-orm";
import { requireAccess } from "@/lib/auth";
import { Megaphone, Users, Target, Zap, TrendingUp, ArrowRight, Key, BarChart2, Server } from "lucide-react";
import Link from "next/link";

export default async function MarketingPage() {
  await requireAccess("/marketing");

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Marcar offline workers sin heartbeat reciente
  await db.execute(
    sql`UPDATE mkt_workers SET status = 'offline'
        WHERE last_heartbeat < NOW() - INTERVAL '90 seconds' AND status != 'offline'`
  );

  const [
    totalLeads,
    leadsContactados,
    leadsInteresados,
    leadsCerrados,
    totalStrategies,
    activeCampaigns,
    recentInteractions,
    onlineWorkers,
  ] = await Promise.all([
    db.select({ count: count() }).from(mktLeads),
    db.select({ count: count() }).from(mktLeads).where(eq(mktLeads.status, "contactado")),
    db.select({ count: count() }).from(mktLeads).where(eq(mktLeads.status, "interesado")),
    db.select({ count: count() }).from(mktLeads).where(eq(mktLeads.status, "cerrado")),
    db.select({ count: count() }).from(mktStrategies),
    db.select({ count: count() }).from(mktCampaigns)
      .where(eq(mktCampaigns.status, "running")),
    db.select().from(mktInteractions)
      .orderBy(desc(mktInteractions.createdAt))
      .limit(8),
    db.select().from(mktWorkers)
      .where(eq(mktWorkers.status, "online"))
      .orderBy(desc(mktWorkers.lastHeartbeat))
      .limit(5),
  ]);

  const stats = [
    {
      label: "Leads totales",
      value: totalLeads[0].count,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Contactados",
      value: leadsContactados[0].count,
      icon: Megaphone,
      color: "text-yellow-600",
      bg: "bg-yellow-50",
    },
    {
      label: "Interesados",
      value: leadsInteresados[0].count,
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Cerrados",
      value: leadsCerrados[0].count,
      icon: Target,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
  ];

  const conversionRate =
    totalLeads[0].count > 0
      ? Math.round((leadsCerrados[0].count / totalLeads[0].count) * 100)
      : 0;

  const interactionTypeLabels: Record<string, string> = {
    scraped: "Scrapeado",
    sent: "Mensaje enviado",
    replied: "Respondió",
    followup_sent: "Follow-up enviado",
    followup_replied: "Respondió follow-up",
    interested: "Interesado",
    not_interested: "No interesado",
    call: "Llamada",
    meeting: "Reunión",
    converted: "Convertido",
    lost: "Perdido",
    note: "Nota",
  };

  const interactionColors: Record<string, string> = {
    sent: "bg-blue-100 text-blue-700",
    replied: "bg-green-100 text-green-700",
    interested: "bg-emerald-100 text-emerald-700",
    converted: "bg-purple-100 text-purple-700",
    lost: "bg-red-100 text-red-700",
    followup_sent: "bg-yellow-100 text-yellow-700",
    scraped: "bg-slate-100 text-slate-600",
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">

      {/* Worker Fleet Status Bar */}
      <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm
        ${onlineWorkers.length > 0
          ? "bg-emerald-50 border-emerald-200 text-emerald-800"
          : "bg-slate-50 border-slate-200 text-slate-500"
        }`}>
        <Server className="w-4 h-4 shrink-0" />
        {onlineWorkers.length > 0 ? (
          <>
            <span className="font-medium">{onlineWorkers.length} worker{onlineWorkers.length > 1 ? "s" : ""} online</span>
            <span className="text-emerald-600">—</span>
            {onlineWorkers.map((w) => (
              <span key={w.id} className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs">{w.hostname ?? w.workerId}</span>
                {w.currentCampaignId && <span className="text-xs text-emerald-600 font-medium">(ejecutando)</span>}
              </span>
            ))}
          </>
        ) : (
          <span>Sin workers conectados — inicia <code className="bg-slate-100 px-1 rounded text-xs">python3 worker.py</code> en tu laptop</span>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-[#1e3a5f]" />
            Marketing
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Estrategias orgánicas, campañas de outreach y seguimiento de leads
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/marketing/strategies"
            className="px-4 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#16305a] transition-colors"
          >
            + Estrategia
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-lg ${s.bg}`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <span className="text-xs text-slate-500 font-medium">{s.label}</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{s.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Conversion rate + active campaigns */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Conversión global</h3>
          <div className="flex items-end gap-3">
            <span className="text-4xl font-bold text-slate-900">{conversionRate}%</span>
            <span className="text-slate-400 text-sm mb-1">leads → clientes</span>
          </div>
          <div className="mt-3 h-2 bg-slate-100 rounded-full">
            <div
              className="h-2 bg-[#1e3a5f] rounded-full transition-all"
              style={{ width: `${Math.min(conversionRate, 100)}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-500" />
            Campañas activas
          </h3>
          <p className="text-4xl font-bold text-slate-900">{activeCampaigns[0].count}</p>
          <p className="text-slate-400 text-sm mt-1">en ejecución ahora</p>
        </div>
      </div>

      {/* Módulos rápidos */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Módulos</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { href: "/marketing/strategies", label: "Estrategias", icon: Target, desc: "Nichos y productos", color: "text-blue-600", count: totalStrategies[0].count },
            { href: "/marketing/campaigns", label: "Campañas", icon: Zap, desc: "Ejecuciones programadas", color: "text-yellow-600", count: activeCampaigns[0].count },
            { href: "/marketing/copies", label: "Copies", icon: Megaphone, desc: "Biblioteca de mensajes", color: "text-purple-600", count: null },
            { href: "/marketing/leads", label: "Leads", icon: Users, desc: "Pipeline completo", color: "text-green-600", count: totalLeads[0].count },
            { href: "/marketing/analytics", label: "Analytics", icon: BarChart2, desc: "Métricas y rendimiento", color: "text-indigo-600", count: null },
            { href: "/marketing/workers", label: "Infraestructura", icon: Server, desc: "Server · Workers · Cuentas WA", color: "text-slate-600", count: onlineWorkers.length || null },
          ].map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="bg-white rounded-xl border border-slate-200 p-4 hover:border-[#1e3a5f] hover:shadow-sm transition-all group"
            >
              <div className="flex items-center justify-between mb-2">
                <m.icon className={`w-5 h-5 ${m.color}`} />
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
              </div>
              <p className="font-semibold text-slate-800 text-sm">{m.label}</p>
              <p className="text-slate-400 text-xs mt-0.5">{m.desc}</p>
              {m.count !== null && (
                <p className="text-xs font-medium text-slate-600 mt-2">{m.count} registros</p>
              )}
            </Link>
          ))}
        </div>
      </div>

      {/* Actividad reciente */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Actividad reciente</h3>
          <Link href="/marketing/leads" className="text-xs text-[#1e3a5f] hover:underline">
            Ver todos los leads →
          </Link>
        </div>
        {recentInteractions.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Megaphone className="w-8 h-8 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Sin actividad aún</p>
            <p className="text-slate-300 text-xs mt-1">
              Conecta tu app de scraping con la API Key para ver datos aquí
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-50">
            {recentInteractions.map((i) => (
              <li key={i.id} className="px-5 py-3 flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${interactionColors[i.type] ?? "bg-slate-100 text-slate-600"}`}>
                  {interactionTypeLabels[i.type] ?? i.type}
                </span>
                <span className="text-slate-400 text-xs ml-auto">
                  {new Date(i.createdAt).toLocaleDateString("es-MX", {
                    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Setup banner si no hay leads */}
      {totalLeads[0].count === 0 && (
        <div className="bg-[#1e3a5f]/5 border border-[#1e3a5f]/20 rounded-xl p-5 flex items-start gap-4">
          <div className="p-2 bg-[#1e3a5f]/10 rounded-lg shrink-0">
            <Key className="w-5 h-5 text-[#1e3a5f]" />
          </div>
          <div>
            <p className="font-semibold text-[#1e3a5f] text-sm">Conecta tu sistema de scraping</p>
            <p className="text-slate-600 text-sm mt-1">
              Configura <code className="bg-slate-100 px-1 rounded text-xs">MKT_API_KEY</code> en tu{" "}
              <code className="bg-slate-100 px-1 rounded text-xs">.env.local</code> y apunta tu app Python a{" "}
              <code className="bg-slate-100 px-1 rounded text-xs">POST /api/mkt/leads/sync</code>
            </p>
            <p className="text-slate-500 text-xs mt-2">
              Endpoints disponibles: leads/sync · leads/followups · interactions · campaigns/active · copies/[id]
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
