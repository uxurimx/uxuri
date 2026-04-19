import { NextResponse } from "next/server";
import { db } from "@/db";
import { mktCampaigns, mktStrategies, mktCopies } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAccess } from "@/lib/auth";
import { pusherServer } from "@/lib/pusher";

// POST /api/mkt/campaigns/[id]/launch
// Pone la campaña en cola y llama al mkt-server para ejecución inmediata.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAccess("/marketing");
  const { id } = await params;

  // Obtener campaña con estrategia y copy para enviar al servidor
  const rows = await db
    .select({
      id:              mktCampaigns.id,
      title:           mktCampaigns.title,
      status:          mktCampaigns.status,
      targetNiche:     mktStrategies.targetNiche,
      targetCity:      mktStrategies.targetCity,
      targetCountry:   mktStrategies.targetCountry,
      copyContent:     mktCopies.content,
    })
    .from(mktCampaigns)
    .leftJoin(mktStrategies, eq(mktCampaigns.strategyId, mktStrategies.id))
    .leftJoin(mktCopies, eq(mktCampaigns.copyId, mktCopies.id))
    .where(eq(mktCampaigns.id, id));

  const row = rows[0];
  if (!row) {
    return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
  }

  // Solo se puede enviar desde "ready" o "scheduled" (envío inmediato cancelando schedule)
  const launchable = ["ready", "scheduled"] as const;
  if (!launchable.includes(row.status as typeof launchable[number])) {
    return NextResponse.json(
      { error: `Solo campañas en estado 'ready' pueden enviarse (actual: '${row.status}'). Primero busca leads.` },
      { status: 409 }
    );
  }

  const [updated] = await db
    .update(mktCampaigns)
    .set({ status: "queued", updatedAt: new Date() })
    .where(eq(mktCampaigns.id, id))
    .returning();

  pusherServer.trigger("mkt-control", "campaign:queued", {
    campaignId: id, title: row.title, timestamp: new Date().toISOString(),
  }).catch(() => {});

  const serverUrl = process.env.MKT_SERVER_URL;
  const serverKey = process.env.MKT_SERVER_KEY;

  if (serverUrl && serverKey) {
    const campaignPayload = {
      id:       row.id,
      title:    row.title,
      strategy: {
        targetNiche:   row.targetNiche,
        targetCity:    row.targetCity,
        targetCountry: row.targetCountry ?? "México",
      },
      copy: row.copyContent ? { body: row.copyContent } : null,
    };

    fetch(`${serverUrl.replace(/\/$/, "")}/api/campaigns/${id}/run`, {
      method:  "POST",
      headers: { "X-API-Key": serverKey, "Content-Type": "application/json" },
      body:    JSON.stringify({ campaign: campaignPayload, mode: "send" }),
    }).catch(() => {});
  }

  return NextResponse.json(updated);
}
