import { NextResponse } from "next/server";
import { db } from "@/db";
import { mktCampaigns } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAccess } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  scheduledAt: z.string().datetime(),
});

// POST /api/mkt/campaigns/[id]/schedule
// Programa una campaña para envío en una fecha/hora específica.
// Solo funciona si la campaña está en estado "ready".
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAccess("/marketing");
  const { id } = await params;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const campaign = await db.query.mktCampaigns?.findFirst({
    where: eq(mktCampaigns.id, id),
  });

  if (!campaign) return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });

  const scheduleable = ["ready", "scheduled"] as const;
  if (!scheduleable.includes(campaign.status as typeof scheduleable[number])) {
    return NextResponse.json(
      { error: `Solo campañas en estado 'ready' pueden programarse (actual: ${campaign.status})` },
      { status: 409 }
    );
  }

  const [updated] = await db
    .update(mktCampaigns)
    .set({
      status:      "scheduled" as never,
      scheduledAt: new Date(parsed.data.scheduledAt),
      updatedAt:   new Date(),
    })
    .where(eq(mktCampaigns.id, id))
    .returning();

  return NextResponse.json(updated);
}

// DELETE /api/mkt/campaigns/[id]/schedule
// Cancela el envío programado, vuelve a "ready".
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAccess("/marketing");
  const { id } = await params;

  const [updated] = await db
    .update(mktCampaigns)
    .set({ status: "ready" as never, scheduledAt: null, updatedAt: new Date() })
    .where(eq(mktCampaigns.id, id))
    .returning();

  if (!updated) return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
  return NextResponse.json(updated);
}
