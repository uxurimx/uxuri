import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { clients, businesses, businessMembers, mktLeads } from "@/db/schema";
import { eq, or, inArray, isNull } from "drizzle-orm";
import { PipelineBoard } from "@/components/clients/pipeline-board";

export default async function ClientPipelinePage() {
  const { userId } = await auth();

  // Clientes del pipeline
  const rows = await db
    .select({
      id: clients.id,
      name: clients.name,
      email: clients.email,
      phone: clients.phone,
      company: clients.company,
      status: clients.status,
      pipelineStage: clients.pipelineStage,
      sourceBusinessId: clients.sourceBusinessId,
      sourceChannel: clients.sourceChannel,
      firstContactDate: clients.firstContactDate,
      estimatedValue: clients.estimatedValue,
      notes: clients.notes,
      createdAt: clients.createdAt,
    })
    .from(clients)
    .orderBy(clients.createdAt);

  // Leads de marketing aún no convertidos a cliente
  const marketingLeads = await db
    .select({
      id: mktLeads.id,
      name: mktLeads.name,
      phone: mktLeads.phone,
      email: mktLeads.email,
      city: mktLeads.city,
      category: mktLeads.category,
      status: mktLeads.status,
      score: mktLeads.score,
      sourceId: mktLeads.sourceId,
      campaignId: mktLeads.campaignId,
      createdAt: mktLeads.createdAt,
    })
    .from(mktLeads)
    .where(isNull(mktLeads.convertedToClientId))
    .orderBy(mktLeads.createdAt);

  // Negocios del usuario
  const userBusinesses = userId
    ? await (async () => {
        const [owned, member] = await Promise.all([
          db.select({ id: businesses.id, name: businesses.name, logo: businesses.logo })
            .from(businesses)
            .where(eq(businesses.ownerId, userId)),
          db.select({ businessId: businessMembers.businessId })
            .from(businessMembers)
            .where(eq(businessMembers.userId, userId)),
        ]);
        const memberIds = member.map(m => m.businessId);
        const memberBizs = memberIds.length > 0
          ? await db.select({ id: businesses.id, name: businesses.name, logo: businesses.logo })
              .from(businesses)
              .where(inArray(businesses.id, memberIds))
          : [];
        return [...owned, ...memberBizs];
      })()
    : [];

  const bizMap = new Map(userBusinesses.map(b => [b.id, b]));
  const clientsWithBiz = rows.map(c => ({
    ...c,
    sourceBizName: c.sourceBusinessId ? (bizMap.get(c.sourceBusinessId)?.name ?? null) : null,
    sourceBizLogo: c.sourceBusinessId ? (bizMap.get(c.sourceBusinessId)?.logo ?? null) : null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pipeline CRM</h1>
          <p className="text-sm text-slate-500 mt-0.5">De primer contacto a cliente activo</p>
        </div>
      </div>
      <PipelineBoard
        clients={clientsWithBiz}
        businesses={userBusinesses}
        marketingLeads={marketingLeads}
      />
    </div>
  );
}
