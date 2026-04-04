import { NextResponse } from "next/server";
import { db } from "@/db";
import { mktCampaigns } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { requireAccess } from "@/lib/auth";
import { pusherServer } from "@/lib/pusher";

// POST /api/mkt/campaigns/[id]/launch
// Llamado desde la UI de Uxuri — pone la campaña en cola para el worker.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAccess("/marketing");
  const { id } = await params;

  const [campaign] = await db
    .select()
    .from(mktCampaigns)
    .where(eq(mktCampaigns.id, id));

  if (!campaign) {
    return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
  }

  const launchable = ["draft", "paused", "failed"] as const;
  if (!launchable.includes(campaign.status as typeof launchable[number])) {
    return NextResponse.json(
      { error: `No se puede lanzar desde estado '${campaign.status}'` },
      { status: 409 }
    );
  }

  const [updated] = await db
    .update(mktCampaigns)
    .set({ status: "queued", updatedAt: new Date() })
    .where(eq(mktCampaigns.id, id))
    .returning();

  // Notificar a workers via Pusher
  pusherServer.trigger("mkt-control", "campaign:queued", {
    campaignId: id,
    title: campaign.title,
    timestamp: new Date().toISOString(),
  }).catch(() => {});

  return NextResponse.json(updated);
}
