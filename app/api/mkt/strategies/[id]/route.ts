import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { mktStrategies, mktCampaigns, mktLeads } from "@/db/schema";
import { eq, count, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullish(),
  productOffered: z.string().nullish(),
  targetNiche: z.string().nullish(),
  targetCity: z.string().nullish(),
  targetCountry: z.string().nullish(),
  channel: z.enum(["whatsapp", "email", "ig_dm", "whatsapp_email", "sms", "other"]).optional(),
  status: z.enum(["draft", "active", "paused", "completed"]).optional(),
  notes: z.string().nullish(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [strategy] = await db
    .select()
    .from(mktStrategies)
    .where(eq(mktStrategies.id, id));

  if (!strategy) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  // Campaigns with stats
  const campaigns = await db
    .select()
    .from(mktCampaigns)
    .where(eq(mktCampaigns.strategyId, id))
    .orderBy(mktCampaigns.createdAt);

  // Lead totals for this strategy
  const [leadStats] = await db
    .select({ total: count() })
    .from(mktLeads)
    .where(eq(mktLeads.strategyId, id));

  const [interestedCount] = await db
    .select({ total: count() })
    .from(mktLeads)
    .where(and(eq(mktLeads.strategyId, id), eq(mktLeads.status, "interesado")));

  const [closedCount] = await db
    .select({ total: count() })
    .from(mktLeads)
    .where(and(eq(mktLeads.strategyId, id), eq(mktLeads.status, "cerrado")));

  return NextResponse.json({
    ...strategy,
    campaigns,
    stats: {
      totalLeads: leadStats?.total ?? 0,
      interested: interestedCount?.total ?? 0,
      closed: closedCount?.total ?? 0,
    },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [updated] = await db
    .update(mktStrategies)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(mktStrategies.id, id))
    .returning();

  if (!updated) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await db.delete(mktStrategies).where(eq(mktStrategies.id, id));
  return NextResponse.json({ ok: true });
}
