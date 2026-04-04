import { db } from "@/db";
import { mktLeads, mktCampaigns } from "@/db/schema";
import { requireAccess } from "@/lib/auth";
import { desc, count, sql } from "drizzle-orm";
import { LeadsTable } from "@/components/marketing/leads-table";
import { Users, Megaphone } from "lucide-react";
import Link from "next/link";

const PAGE_SIZE = 50;

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  await requireAccess("/marketing");

  const sp = await searchParams;
  const page = parseInt(sp.page ?? "0");

  // Opciones para los dropdowns de filtro
  const [allLeadsNiches, allLeadsCities, campaigns, [{ total }]] = await Promise.all([
    db.execute(sql`SELECT DISTINCT niche FROM mkt_leads WHERE niche IS NOT NULL ORDER BY niche`),
    db.execute(sql`SELECT DISTINCT city FROM mkt_leads WHERE city IS NOT NULL ORDER BY city`),
    db.select({ id: mktCampaigns.id, title: mktCampaigns.title }).from(mktCampaigns).orderBy(mktCampaigns.title),
    db.select({ total: count() }).from(mktLeads),
  ]);

  // Fetch inicial con offset de página (si viene de URL)
  const initialLeads = await db
    .select({
      id: mktLeads.id,
      name: mktLeads.name,
      niche: mktLeads.niche,
      city: mktLeads.city,
      phone: mktLeads.phone,
      email: mktLeads.email,
      status: mktLeads.status,
      score: mktLeads.score,
      hasWhatsapp: mktLeads.hasWhatsapp,
      rating: mktLeads.rating,
      templateUsed: mktLeads.templateUsed,
      contactedAt: mktLeads.contactedAt,
      lastActivity: mktLeads.lastActivity,
      campaignId: mktLeads.campaignId,
      webSource: mktLeads.webSource,
    })
    .from(mktLeads)
    .orderBy(desc(mktLeads.lastActivity), desc(mktLeads.createdAt))
    .limit(PAGE_SIZE)
    .offset(page * PAGE_SIZE);

  const niches = (allLeadsNiches.rows as { niche: string }[]).map((r) => r.niche).filter(Boolean);
  const cities = (allLeadsCities.rows as { city: string }[]).map((r) => r.city).filter(Boolean);

  const serialized = initialLeads.map((l) => ({
    ...l,
    contactedAt: l.contactedAt?.toISOString() ?? null,
    lastActivity: l.lastActivity?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#1e3a5f]/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-[#1e3a5f]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
            <p className="text-sm text-slate-500">{total.toLocaleString()} leads en total</p>
          </div>
        </div>
        <Link href="/marketing" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
          <Megaphone className="w-4 h-4" />
          Marketing
        </Link>
      </div>

      <LeadsTable
        initialLeads={serialized}
        totalCount={total}
        filterOptions={{ niches, cities, campaigns }}
      />
    </div>
  );
}
