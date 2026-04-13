import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { clients, businesses, businessMembers } from "@/db/schema";
import { eq, or, inArray } from "drizzle-orm";
import { PipelineBoard } from "@/components/clients/pipeline-board";

export default async function ClientPipelinePage() {
  const { userId } = await auth();

  // Todos los clientes + join a negocio origen
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

  // Negocios del usuario para el selector de origen
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

  // Resolver nombre del negocio origen para cada cliente
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
      <PipelineBoard clients={clientsWithBiz} businesses={userBusinesses} />
    </div>
  );
}
