import { NextResponse } from "next/server";
import { db } from "@/db";
import { mktCampaigns } from "@/db/schema";
import { eq } from "drizzle-orm";
import { validateMktApiKey, unauthorizedResponse } from "@/lib/mkt-auth";
import { pusherServer } from "@/lib/pusher";
import { z } from "zod";

const schema = z.object({
  sent:    z.number().int().min(0).optional(),
  failed:  z.number().int().min(0).optional(),
  total:   z.number().int().min(0).nullish(),
  scraped: z.number().int().min(0).nullish(),
  status:  z.enum(["scraping", "running"]).nullish(),
  // Logs del executor — array de líneas de texto, max 50 por batch
  logs:    z.array(z.string().max(400)).max(50).optional(),
});

// PATCH /api/mkt/campaigns/[id]/progress
// Worker reporta progreso y/o logs en tiempo real → Pusher → dashboard.
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

  const { sent, failed, total, scraped, status, logs } = parsed.data;
  const hasCounters = sent != null || failed != null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let currentStatus: any = status ?? undefined;

  if (hasCounters) {
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (sent    != null) update.contacted   = sent;
    if (failed  != null) update.failedCount = failed;
    if (total   != null) update.totalLeads  = total;
    if (scraped != null) update.scrapedCount = scraped;
    if (status)          update.status      = status;

    const [updated] = await db
      .update(mktCampaigns)
      .set(update as never)
      .where(eq(mktCampaigns.id, id))
      .returning({ id: mktCampaigns.id, status: mktCampaigns.status });

    if (!updated) {
      return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
    }
    currentStatus = status ?? updated.status;
  }

  // Pusher — siempre emitir si hay contadores O si hay logs
  if (hasCounters || (logs && logs.length > 0)) {
    pusherServer.trigger("mkt-campaigns", `campaign:${id}:progress`, {
      ...(hasCounters && {
        sent:    sent ?? 0,
        failed:  failed ?? 0,
        total:   total   ?? null,
        scraped: scraped ?? null,
        status:  currentStatus,
        pct:     total ? Math.round(((sent ?? 0) / total) * 100) : null,
      }),
      logs: logs ?? [],
      ts:   Date.now(),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
