import { NextResponse } from "next/server";
import { db } from "@/db";
import { mktCampaigns, mktStrategies, mktCopies } from "@/db/schema";
import { eq, and, lte, inArray } from "drizzle-orm";
import { validateMktApiKey, unauthorizedResponse } from "@/lib/mkt-auth";

// GET /api/mkt/campaigns/scheduled
// Retorna campañas con status=scheduled cuyo scheduledAt ya llegó.
// Llamado por el scheduler del mkt-server cada 60s.
export async function GET(req: Request) {
  if (!validateMktApiKey(req)) return unauthorizedResponse();

  const now = new Date();

  const campaigns = await db
    .select()
    .from(mktCampaigns)
    .where(and(
      eq(mktCampaigns.status, "scheduled" as never),
      lte(mktCampaigns.scheduledAt, now),
    ));

  if (!campaigns.length) return NextResponse.json([]);

  const strategyIds = campaigns.map((c) => c.strategyId).filter(Boolean) as string[];
  const copyIds     = campaigns.map((c) => c.copyId).filter(Boolean) as string[];

  const [strategies, copies] = await Promise.all([
    strategyIds.length
      ? db.select().from(mktStrategies).where(inArray(mktStrategies.id, strategyIds))
      : Promise.resolve([]),
    copyIds.length
      ? db.select().from(mktCopies).where(inArray(mktCopies.id, copyIds))
      : Promise.resolve([]),
  ]);

  const strategyMap = Object.fromEntries(strategies.map((s) => [s.id, s]));
  const copyMap     = Object.fromEntries(copies.map((c) => [c.id, c]));

  return NextResponse.json(
    campaigns.map((c) => ({
      ...c,
      strategy: c.strategyId ? strategyMap[c.strategyId] ?? null : null,
      copy:     c.copyId     ? { body: copyMap[c.copyId]?.content ?? null } : null,
    }))
  );
}
