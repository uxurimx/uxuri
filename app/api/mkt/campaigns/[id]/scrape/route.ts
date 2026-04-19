import { NextResponse } from "next/server";
import { db } from "@/db";
import { mktCampaigns, mktStrategies } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAccess } from "@/lib/auth";

// POST /api/mkt/campaigns/[id]/scrape
// Dispara solo el scraping de leads — sin enviar WhatsApp.
// El mkt-server busca en Google Maps y asocia los leads a esta campaña.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAccess("/marketing");
  const { id } = await params;

  const rows = await db
    .select({
      id:                mktCampaigns.id,
      title:             mktCampaigns.title,
      status:            mktCampaigns.status,
      strategyId:        mktCampaigns.strategyId,
      targetNiche:       mktStrategies.targetNiche,
      targetCity:        mktStrategies.targetCity,
      targetCountry:     mktStrategies.targetCountry,
      maxLeadsPerQuery:  mktStrategies.maxLeadsPerQuery,
      scraperTimeoutMin: mktStrategies.scraperTimeoutMin,
    })
    .from(mktCampaigns)
    .leftJoin(mktStrategies, eq(mktCampaigns.strategyId, mktStrategies.id))
    .where(eq(mktCampaigns.id, id));

  const row = rows[0];
  if (!row) return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });

  const scrapeable = ["draft", "paused", "failed", "ready"] as const;
  if (!scrapeable.includes(row.status as typeof scrapeable[number])) {
    return NextResponse.json(
      { error: `No se puede buscar leads desde estado '${row.status}'` },
      { status: 409 }
    );
  }

  // Marcar como "buscando"
  const [updated] = await db
    .update(mktCampaigns)
    .set({ status: "scraping", updatedAt: new Date() })
    .where(eq(mktCampaigns.id, id))
    .returning();

  const serverUrl = process.env.MKT_SERVER_URL;
  const serverKey = process.env.MKT_SERVER_KEY;

  if (serverUrl && serverKey) {
    const campaignPayload = {
      id:       row.id,
      title:    row.title,
      strategyId: row.strategyId,
      strategy: {
        id:                row.strategyId,
        targetNiche:       row.targetNiche,
        targetCity:        row.targetCity,
        targetCountry:     row.targetCountry ?? "México",
        maxLeadsPerQuery:  row.maxLeadsPerQuery ?? 50,
        scraperTimeoutMin: row.scraperTimeoutMin ?? 30,
      },
    };

    fetch(`${serverUrl.replace(/\/$/, "")}/api/campaigns/${id}/scrape`, {
      method:  "POST",
      headers: { "X-API-Key": serverKey, "Content-Type": "application/json" },
      body:    JSON.stringify({ campaign: campaignPayload, mode: "scrape" }),
    }).catch(() => {});
  }

  return NextResponse.json(updated);
}
