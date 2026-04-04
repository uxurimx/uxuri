import { NextResponse } from "next/server";
import { db } from "@/db";
import { mktCampaigns } from "@/db/schema";
import { eq } from "drizzle-orm";
import { validateMktApiKey, unauthorizedResponse } from "@/lib/mkt-auth";
import { pusherServer } from "@/lib/pusher";
import { z } from "zod";

const schema = z.object({
  sent:         z.number().int().min(0),
  failed:       z.number().int().min(0),
  scraped:      z.number().int().min(0).default(0),
  errorMessage: z.string().nullish(),
});

// POST /api/mkt/campaigns/[id]/complete
// Worker finaliza la campaña con resumen.
export async function POST(
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

  const { sent, failed, scraped, errorMessage } = parsed.data;
  const finalStatus = errorMessage ? "failed" : "completed";

  const [updated] = await db
    .update(mktCampaigns)
    .set({
      status:       finalStatus,
      contacted:    sent,
      failedCount:  failed,
      scrapedCount: scraped,
      totalLeads:   sent + failed,
      completedAt:  new Date(),
      errorMessage: errorMessage ?? null,
      updatedAt:    new Date(),
    })
    .where(eq(mktCampaigns.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
  }

  // Notificar al dashboard que terminó
  pusherServer.trigger("mkt-campaigns", `campaign:${id}:progress`, {
    sent,
    failed,
    scraped,
    status: finalStatus,
    pct:    100,
    done:   true,
    error:  errorMessage ?? null,
    ts:     Date.now(),
  }).catch(() => {});

  pusherServer.trigger("mkt-control", "campaign:completed", {
    campaignId: id,
    status:     finalStatus,
    sent,
    failed,
    ts: Date.now(),
  }).catch(() => {});

  return NextResponse.json(updated);
}
