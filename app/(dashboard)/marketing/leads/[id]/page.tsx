import { db } from "@/db";
import { mktLeads, mktInteractions, mktCampaigns, mktStrategies, mktCopies, users } from "@/db/schema";
import { eq, asc, inArray } from "drizzle-orm";
import { requireAccess } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { LeadDetail } from "@/components/marketing/lead-detail";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAccess("/marketing");
  const { id } = await params;

  if (!UUID_RE.test(id)) notFound();

  const [lead] = await db.select().from(mktLeads).where(eq(mktLeads.id, id));
  if (!lead) notFound();

  const interactions = await db
    .select()
    .from(mktInteractions)
    .where(eq(mktInteractions.leadId, id))
    .orderBy(asc(mktInteractions.createdAt));

  // Enriquecer interacciones con nombre del worker
  const workerIds = [...new Set(interactions.map((i) => i.workerId).filter(Boolean))] as string[];
  const workersData = workerIds.length
    ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, workerIds))
    : [];
  const workerMap = Object.fromEntries(workersData.map((w) => [w.id, w.name]));

  // Info de campaña / estrategia / copy
  const [campaign, strategy, copy] = await Promise.all([
    lead.campaignId
      ? db.select({ id: mktCampaigns.id, title: mktCampaigns.title }).from(mktCampaigns).where(eq(mktCampaigns.id, lead.campaignId)).then((r) => r[0] ?? null)
      : Promise.resolve(null),
    lead.strategyId
      ? db.select({ id: mktStrategies.id, title: mktStrategies.title }).from(mktStrategies).where(eq(mktStrategies.id, lead.strategyId)).then((r) => r[0] ?? null)
      : Promise.resolve(null),
    lead.copyId
      ? db.select({ id: mktCopies.id, title: mktCopies.title }).from(mktCopies).where(eq(mktCopies.id, lead.copyId)).then((r) => r[0] ?? null)
      : Promise.resolve(null),
  ]);

  // Serializar fechas para el client component
  const serializedLead = {
    ...lead,
    contactedAt: lead.contactedAt?.toISOString() ?? null,
    lastActivity: lead.lastActivity?.toISOString() ?? null,
    nextFollowup: lead.nextFollowup?.toISOString() ?? null,
    convertedAt: lead.convertedAt?.toISOString() ?? null,
    scrapedAt: lead.scrapedAt?.toISOString() ?? null,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  };

  const serializedInteractions = interactions.map((i) => ({
    ...i,
    workerName: i.workerId ? (workerMap[i.workerId] ?? null) : null,
    createdAt: i.createdAt.toISOString(),
  }));

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/marketing" className="hover:text-slate-700">Marketing</Link>
        <span>/</span>
        <Link href="/marketing/leads" className="hover:text-slate-700">Leads</Link>
        <span>/</span>
        <span className="text-slate-800 font-medium truncate">{lead.name ?? id.slice(0, 8)}</span>
      </div>

      <LeadDetail
        lead={serializedLead}
        interactions={serializedInteractions}
        campaignTitle={campaign?.title ?? null}
        strategyTitle={strategy?.title ?? null}
        copyTitle={copy?.title ?? null}
      />
    </div>
  );
}
