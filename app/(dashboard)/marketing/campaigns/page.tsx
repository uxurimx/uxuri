import { db } from "@/db";
import { mktCampaigns, mktStrategies, mktCopies, users } from "@/db/schema";
import { desc, inArray, ne } from "drizzle-orm";
import { requireAccess } from "@/lib/auth";
import { CampaignsList } from "@/components/marketing/campaigns-list";

export default async function CampaignsPage() {
  await requireAccess("/marketing");

  const campaigns = await db
    .select()
    .from(mktCampaigns)
    .orderBy(desc(mktCampaigns.createdAt));

  const strategyIds = campaigns.map((c) => c.strategyId).filter(Boolean) as string[];
  const copyIds = campaigns.map((c) => c.copyId).filter(Boolean) as string[];
  const workerIds = campaigns.map((c) => c.assignedTo).filter(Boolean) as string[];

  const [strategiesData, copiesData, workersData, allStrategies, allCopies, allUsers] = await Promise.all([
    strategyIds.length
      ? db.select({ id: mktStrategies.id, title: mktStrategies.title, targetNiche: mktStrategies.targetNiche, targetCity: mktStrategies.targetCity })
          .from(mktStrategies).where(inArray(mktStrategies.id, strategyIds))
      : Promise.resolve([]),
    copyIds.length
      ? db.select({ id: mktCopies.id, title: mktCopies.title, type: mktCopies.type, abVariant: mktCopies.abVariant })
          .from(mktCopies).where(inArray(mktCopies.id, copyIds))
      : Promise.resolve([]),
    workerIds.length
      ? db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, workerIds))
      : Promise.resolve([]),
    // Para el selector del modal
    db.select({ id: mktStrategies.id, title: mktStrategies.title, targetNiche: mktStrategies.targetNiche, targetCity: mktStrategies.targetCity })
      .from(mktStrategies).orderBy(mktStrategies.title),
    db.select({ id: mktCopies.id, title: mktCopies.title, type: mktCopies.type, abVariant: mktCopies.abVariant })
      .from(mktCopies).where(ne(mktCopies.status, "archived")).orderBy(mktCopies.title),
    db.select({ id: users.id, name: users.name }).from(users).orderBy(users.name),
  ]);

  const strategyMap = Object.fromEntries(strategiesData.map((s) => [s.id, s]));
  const copyMap = Object.fromEntries(copiesData.map((c) => [c.id, c]));
  const workerMap = Object.fromEntries(workersData.map((w) => [w.id, w]));

  const enriched = campaigns.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    scheduledAt: c.scheduledAt?.toISOString() ?? null,
    startedAt: c.startedAt?.toISOString() ?? null,
    completedAt: c.completedAt?.toISOString() ?? null,
    strategy: c.strategyId ? (strategyMap[c.strategyId] ?? null) : null,
    copy: c.copyId ? (copyMap[c.copyId] ?? null) : null,
    worker: c.assignedTo ? (workerMap[c.assignedTo] ?? null) : null,
  }));

  return (
    <CampaignsList
      initialCampaigns={enriched}
      strategies={allStrategies}
      copies={allCopies}
      workers={allUsers}
    />
  );
}
