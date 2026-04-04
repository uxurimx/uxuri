import { db } from "@/db";
import { mktStrategies, mktCampaigns } from "@/db/schema";
import { desc, count, eq } from "drizzle-orm";
import { requireAccess } from "@/lib/auth";
import { StrategiesList } from "@/components/marketing/strategies-list";

export default async function StrategiesPage() {
  await requireAccess("/marketing");

  const [strategies, campaignCounts] = await Promise.all([
    db.select().from(mktStrategies).orderBy(desc(mktStrategies.createdAt)),
    db.select({ strategyId: mktCampaigns.strategyId, total: count() })
      .from(mktCampaigns)
      .groupBy(mktCampaigns.strategyId),
  ]);

  const countMap = Object.fromEntries(
    campaignCounts.map((c) => [c.strategyId, c.total])
  );

  const enriched = strategies.map((s) => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    campaignCount: countMap[s.id] ?? 0,
  }));

  return <StrategiesList initialStrategies={enriched} />;
}
