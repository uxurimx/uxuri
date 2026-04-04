import { db } from "@/db";
import { mktLeads, mktCampaigns, mktStrategies, mktInteractions, users } from "@/db/schema";
import { requireAccess } from "@/lib/auth";
import { eq, count, sql, desc } from "drizzle-orm";
import { BarChart2, Megaphone } from "lucide-react";
import Link from "next/link";
import { AnalyticsClient } from "@/components/marketing/analytics-client";

export default async function MarketingAnalyticsPage() {
  await requireAccess("/marketing");

  // ── KPI base ──────────────────────────────────────────────────────────────
  const [
    [{ total: totalLeads }],
    [{ total: waConfirmed }],
    [{ total: converted }],
  ] = await Promise.all([
    db.select({ total: count() }).from(mktLeads),
    db.select({ total: count() }).from(mktLeads).where(eq(mktLeads.hasWhatsapp, 1)),
    db.select({ total: count() }).from(mktLeads).where(eq(mktLeads.status, "cerrado")),
  ]);

  const avgScoreResult = await db.execute(
    sql`SELECT ROUND(AVG(score)::numeric, 1) as avg FROM mkt_leads WHERE score IS NOT NULL`
  );
  const avgScore = Number((avgScoreResult.rows[0] as { avg: string | null })?.avg ?? 0);

  const sentLast30Result = await db.execute(
    sql`SELECT COUNT(*) as count FROM mkt_interactions WHERE type = 'sent' AND created_at >= NOW() - INTERVAL '30 days'`
  );
  const sentLast30 = Number((sentLast30Result.rows[0] as { count: string })?.count ?? 0);

  // ── Funnel por status ─────────────────────────────────────────────────────
  const funnelResult = await db.execute(
    sql`SELECT status, COUNT(*)::int as count FROM mkt_leads GROUP BY status`
  );
  const funnelMap = Object.fromEntries(
    (funnelResult.rows as { status: string; count: number }[]).map((r) => [r.status, r.count])
  );
  const funnelOrder = ["nuevo", "pendiente", "contactado", "interesado", "no_responde", "sin_whatsapp", "cerrado", "descartado"];
  const funnel = funnelOrder.map((s) => ({ status: s, count: funnelMap[s] ?? 0 }));

  // ── Top nichos ────────────────────────────────────────────────────────────
  const nichosResult = await db.execute(sql`
    SELECT niche,
           COUNT(*)::int AS total,
           SUM(CASE WHEN status IN ('interesado','cerrado') THEN 1 ELSE 0 END)::int AS hot,
           ROUND(AVG(score)::numeric, 1) AS avg_score
    FROM mkt_leads
    WHERE niche IS NOT NULL AND niche != ''
    GROUP BY niche
    ORDER BY total DESC
    LIMIT 12
  `);
  const topNiches = nichosResult.rows as { niche: string; total: number; hot: number; avg_score: string }[];

  // ── Top ciudades ──────────────────────────────────────────────────────────
  const citiesResult = await db.execute(sql`
    SELECT city, COUNT(*)::int AS total,
           SUM(CASE WHEN status IN ('interesado','cerrado') THEN 1 ELSE 0 END)::int AS hot
    FROM mkt_leads
    WHERE city IS NOT NULL AND city != ''
    GROUP BY city ORDER BY total DESC LIMIT 12
  `);
  const topCities = citiesResult.rows as { city: string; total: number; hot: number }[];

  // ── Actividad por día de la semana ────────────────────────────────────────
  const dowResult = await db.execute(sql`
    SELECT EXTRACT(DOW FROM created_at)::int AS dow, COUNT(*)::int AS count
    FROM mkt_interactions
    WHERE type = 'sent'
    GROUP BY dow ORDER BY dow
  `);
  const dowMap = Object.fromEntries(
    (dowResult.rows as { dow: number; count: number }[]).map((r) => [r.dow, r.count])
  );
  // 0=Dom,1=Lun,...,6=Sáb → reordenar a Lun-Dom
  const dowLabels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const dowData = [1, 2, 3, 4, 5, 6, 0].map((d) => ({
    label: dowLabels[d],
    count: dowMap[d] ?? 0,
  }));

  // ── A/B templates ─────────────────────────────────────────────────────────
  const abResult = await db.execute(sql`
    SELECT template_used,
           COUNT(*)::int AS total,
           SUM(CASE WHEN status IN ('interesado','cerrado') THEN 1 ELSE 0 END)::int AS converted
    FROM mkt_leads
    WHERE template_used IS NOT NULL
    GROUP BY template_used
    ORDER BY total DESC
    LIMIT 10
  `);
  const abStats = (abResult.rows as { template_used: string; total: number; converted: number }[]).map((r) => ({
    template: r.template_used,
    total: r.total,
    converted: r.converted,
    rate: r.total > 0 ? Math.round((r.converted / r.total) * 100) : 0,
  }));

  // ── Timeline últimos 30 días ───────────────────────────────────────────────
  const timelineResult = await db.execute(sql`
    SELECT DATE(created_at) AS day,
           SUM(CASE WHEN type = 'sent' THEN 1 ELSE 0 END)::int AS sent,
           SUM(CASE WHEN type IN ('replied','interested') THEN 1 ELSE 0 END)::int AS replies
    FROM mkt_interactions
    WHERE created_at >= NOW() - INTERVAL '30 days'
      AND type IN ('sent','replied','interested')
    GROUP BY day
    ORDER BY day
  `);
  // Build full 30-day array (fill gaps with 0)
  const today = new Date();
  const timelineDays: { day: string; sent: number; replies: number }[] = [];
  const timelineMap = Object.fromEntries(
    (timelineResult.rows as { day: string; sent: number; replies: number }[]).map((r) => [
      r.day.toString().slice(0, 10),
      { sent: r.sent, replies: r.replies },
    ])
  );
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const entry = timelineMap[key] ?? { sent: 0, replies: 0 };
    timelineDays.push({ day: key, sent: entry.sent, replies: entry.replies });
  }

  // ── Campañas recientes ────────────────────────────────────────────────────
  const campaigns = await db
    .select({
      id: mktCampaigns.id,
      title: mktCampaigns.title,
      status: mktCampaigns.status,
      totalLeads: mktCampaigns.totalLeads,
      contacted: mktCampaigns.contacted,
      responded: mktCampaigns.responded,
      interested: mktCampaigns.interested,
      converted: mktCampaigns.converted,
      startedAt: mktCampaigns.startedAt,
    })
    .from(mktCampaigns)
    .orderBy(desc(mktCampaigns.createdAt))
    .limit(8);

  // ── Workers ───────────────────────────────────────────────────────────────
  const workersResult = await db.execute(sql`
    SELECT u.name,
           COUNT(*)::int AS total,
           SUM(CASE WHEN i.type = 'sent' THEN 1 ELSE 0 END)::int AS sent,
           SUM(CASE WHEN i.type IN ('replied','interested') THEN 1 ELSE 0 END)::int AS replies
    FROM mkt_interactions i
    JOIN users u ON i.worker_id = u.id
    WHERE i.worker_id IS NOT NULL
    GROUP BY u.id, u.name
    ORDER BY total DESC
    LIMIT 8
  `);
  const workers = workersResult.rows as { name: string; total: number; sent: number; replies: number }[];

  // ── Serialize dates ───────────────────────────────────────────────────────
  const serializedCampaigns = campaigns.map((c) => ({
    ...c,
    startedAt: c.startedAt?.toISOString() ?? null,
  }));

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#1e3a5f]/10 flex items-center justify-center">
            <BarChart2 className="w-5 h-5 text-[#1e3a5f]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
            <p className="text-sm text-slate-500">Rendimiento de campañas y leads</p>
          </div>
        </div>
        <Link href="/marketing" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
          <Megaphone className="w-4 h-4" />
          Marketing
        </Link>
      </div>

      <AnalyticsClient
        kpis={{ totalLeads, waConfirmed, converted, avgScore, sentLast30 }}
        funnel={funnel}
        topNiches={topNiches}
        topCities={topCities}
        dowData={dowData}
        abStats={abStats}
        timeline={timelineDays}
        campaigns={serializedCampaigns}
        workers={workers}
      />
    </div>
  );
}
