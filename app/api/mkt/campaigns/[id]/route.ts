import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { mktCampaigns, mktStrategies, mktCopies, mktLeads, users } from "@/db/schema";
import { eq, count, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  strategyId: z.string().uuid().nullable().optional(),
  copyId: z.string().uuid().nullable().optional(),
  assignedTo: z.string().nullable().optional(),
  scheduledAt: z.string().nullable().optional(),
  status: z.enum(["draft", "queued", "running", "completed", "paused", "failed"]).optional(),
  notes: z.string().nullish(),
  totalLeads: z.number().int().optional(),
  contacted: z.number().int().optional(),
  responded: z.number().int().optional(),
  interested: z.number().int().optional(),
  converted: z.number().int().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [campaign] = await db
    .select()
    .from(mktCampaigns)
    .where(eq(mktCampaigns.id, id));

  if (!campaign) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  const [strategy, copy, worker] = await Promise.all([
    campaign.strategyId
      ? db.select().from(mktStrategies).where(eq(mktStrategies.id, campaign.strategyId)).then((r) => r[0] ?? null)
      : Promise.resolve(null),
    campaign.copyId
      ? db.select().from(mktCopies).where(eq(mktCopies.id, campaign.copyId)).then((r) => r[0] ?? null)
      : Promise.resolve(null),
    campaign.assignedTo
      ? db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, campaign.assignedTo)).then((r) => r[0] ?? null)
      : Promise.resolve(null),
  ]);

  // Lead breakdown for this campaign
  const [totalLeadsDB] = await db.select({ total: count() }).from(mktLeads).where(eq(mktLeads.campaignId, id));
  const [interesadosDB] = await db.select({ total: count() }).from(mktLeads).where(and(eq(mktLeads.campaignId, id), eq(mktLeads.status, "interesado")));
  const [cerradosDB] = await db.select({ total: count() }).from(mktLeads).where(and(eq(mktLeads.campaignId, id), eq(mktLeads.status, "cerrado")));

  return NextResponse.json({
    ...campaign,
    strategy,
    copy,
    worker,
    leadStats: {
      total: totalLeadsDB?.total ?? 0,
      interested: interesadosDB?.total ?? 0,
      closed: cerradosDB?.total ?? 0,
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

  const data: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
  if (parsed.data.scheduledAt !== undefined) {
    data.scheduledAt = parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null;
  }
  if (parsed.data.status === "running" && !data.startedAt) {
    data.startedAt = new Date();
  }
  if (parsed.data.status === "completed" && !data.completedAt) {
    data.completedAt = new Date();
  }

  const [updated] = await db
    .update(mktCampaigns)
    .set(data as never)
    .where(eq(mktCampaigns.id, id))
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
  await db.delete(mktCampaigns).where(eq(mktCampaigns.id, id));
  return NextResponse.json({ ok: true });
}
