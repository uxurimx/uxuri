import { NextResponse } from "next/server";
import { db } from "@/db";
import { mktCampaigns, mktCopies, mktStrategies } from "@/db/schema";
import { eq, or, inArray } from "drizzle-orm";
import { validateMktApiKey, unauthorizedResponse } from "@/lib/mkt-auth";
import { auth } from "@clerk/nextjs/server";

export async function GET(req: Request) {
  const apiKeyValid = validateMktApiKey(req);
  if (!apiKeyValid) {
    const { userId } = await auth();
    if (!userId) return unauthorizedResponse();
  }

  // Campañas activas o en cola — la app Python jala esto para saber qué ejecutar
  const campaigns = await db
    .select()
    .from(mktCampaigns)
    .where(or(eq(mktCampaigns.status, "queued"), eq(mktCampaigns.status, "running")));

  if (!campaigns.length) return NextResponse.json([]);

  // Enriquecer con copy y estrategia
  const copyIds = campaigns.map((c) => c.copyId).filter(Boolean) as string[];
  const strategyIds = campaigns.map((c) => c.strategyId).filter(Boolean) as string[];

  const [copies, strategies] = await Promise.all([
    copyIds.length
      ? db.select().from(mktCopies).where(inArray(mktCopies.id, copyIds))
      : Promise.resolve([]),
    strategyIds.length
      ? db.select().from(mktStrategies).where(inArray(mktStrategies.id, strategyIds))
      : Promise.resolve([]),
  ]);

  const copyMap = Object.fromEntries(copies.map((c) => [c.id, c]));
  const strategyMap = Object.fromEntries(strategies.map((s) => [s.id, s]));

  const result = campaigns.map((c) => ({
    ...c,
    copy: c.copyId ? copyMap[c.copyId] ?? null : null,
    strategy: c.strategyId ? strategyMap[c.strategyId] ?? null : null,
  }));

  return NextResponse.json(result);
}
