import { NextResponse } from "next/server";
import { db } from "@/db";
import { mktCampaigns } from "@/db/schema";
import { eq } from "drizzle-orm";
import { validateMktApiKey, unauthorizedResponse } from "@/lib/mkt-auth";
import { pusherServer } from "@/lib/pusher";
import { z } from "zod";

const schema = z.object({
  sent:    z.number().int().min(0),
  failed:  z.number().int().min(0),
  total:   z.number().int().min(0).nullish(),
  scraped: z.number().int().min(0).nullish(),
  status:  z.enum(["scraping", "running"]).nullish(),
});

// PATCH /api/mkt/campaigns/[id]/progress
// Worker reporta progreso en tiempo real → Pusher → dashboard esposa.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateMktApiKey(req)) return unauthorizedResponse();

  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { sent, failed, total, scraped, status } = parsed.data;

  const update: Record<string, unknown> = {
    contacted:   sent,
    failedCount: failed,
    updatedAt:   new Date(),
  };
  if (total != null)   update.totalLeads   = total;
  if (scraped != null) update.scrapedCount = scraped;
  if (status)          update.status       = status;

  const [updated] = await db
    .update(mktCampaigns)
    .set(update as never)
    .where(eq(mktCampaigns.id, id))
    .returning({ id: mktCampaigns.id, status: mktCampaigns.status });

  if (!updated) {
    return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
  }

  // Pusher → barra de progreso en tiempo real
  pusherServer.trigger("mkt-campaigns", `campaign:${id}:progress`, {
    sent,
    failed,
    total:   total ?? null,
    scraped: scraped ?? null,
    status:  status ?? updated.status,
    pct:     total ? Math.round((sent / total) * 100) : null,
    ts:      Date.now(),
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
