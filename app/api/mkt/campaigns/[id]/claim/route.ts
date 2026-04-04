import { NextResponse } from "next/server";
import { db } from "@/db";
import { mktCampaigns, mktStrategies, mktCopies } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { validateMktApiKey, unauthorizedResponse } from "@/lib/mkt-auth";
import { pusherServer } from "@/lib/pusher";
import { z } from "zod";

const schema = z.object({ workerId: z.string() });

// POST /api/mkt/campaigns/[id]/claim
// Lock atómico: solo un worker puede tomar la campaña.
// Usa FOR UPDATE SKIP LOCKED para evitar race conditions.
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

  const { workerId } = parsed.data;

  // Claim atómico: actualizar solo si sigue en 'queued'
  const [claimed] = await db
    .update(mktCampaigns)
    .set({
      status:    "claimed",
      workerId,
      claimedAt: new Date(),
      startedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(mktCampaigns.id, id),
        eq(mktCampaigns.status, "queued"),
      )
    )
    .returning();

  if (!claimed) {
    // Ya tomada por otro worker o no en estado queued
    return NextResponse.json({ error: "Campaña no disponible" }, { status: 409 });
  }

  // Enriquecer con copy y estrategia para que el executor tenga todo
  const [copy, strategy] = await Promise.all([
    claimed.copyId
      ? db.select().from(mktCopies).where(eq(mktCopies.id, claimed.copyId)).then(r => r[0] ?? null)
      : Promise.resolve(null),
    claimed.strategyId
      ? db.select().from(mktStrategies).where(eq(mktStrategies.id, claimed.strategyId)).then(r => r[0] ?? null)
      : Promise.resolve(null),
  ]);

  pusherServer.trigger("mkt-control", "campaign:claimed", {
    campaignId: id,
    workerId,
    timestamp: new Date().toISOString(),
  }).catch(() => {});

  return NextResponse.json({ ...claimed, copy, strategy });
}
