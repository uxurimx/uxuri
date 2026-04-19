import { NextResponse } from "next/server";
import { db } from "@/db";
import { mktLeads } from "@/db/schema";
import { eq } from "drizzle-orm";
import { validateMktApiKey, unauthorizedResponse } from "@/lib/mkt-auth";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

const patchSchema = z.object({
  status: z.enum(["nuevo", "pendiente", "contactado", "interesado", "no_responde", "sin_whatsapp", "descartado", "cerrado"]).optional(),
  notes: z.string().optional(),
  hasWhatsapp: z.number().int().nullable().optional(),
  templateUsed: z.string().optional(),
  copyId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
  strategyId: z.string().uuid().optional(),
  contactedBy: z.string().optional(),
  contactedAt: z.string().optional(),
  lastActivity: z.string().optional(),
  followupStep: z.number().int().optional(),
  nextFollowup: z.string().nullable().optional(),
  convertedToClientId: z.string().uuid().nullable().optional(),
  convertedAt: z.string().nullable().optional(),
  assignedTo: z.string().optional(),
  score: z.number().int().optional(),
  // Fase 3 — enriquecimiento social
  socialData: z.record(z.unknown()).nullable().optional(),
  socialFb:   z.string().max(500).nullable().optional(),
  socialIg:   z.string().max(500).nullable().optional(),
  // Fase 2 — aprobación para envío
  approvedForSend: z.number().int().min(0).max(1).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const apiKeyValid = validateMktApiKey(req);
  if (!apiKeyValid) {
    const { userId } = await auth();
    if (!userId) return unauthorizedResponse();
  }

  const { id } = await params;

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const update: Record<string, unknown> = { updatedAt: new Date() };

  if (data.status !== undefined) update.status = data.status;
  if (data.notes !== undefined) update.notes = data.notes;
  if (data.hasWhatsapp !== undefined) update.hasWhatsapp = data.hasWhatsapp;
  if (data.templateUsed !== undefined) update.templateUsed = data.templateUsed;
  if (data.copyId !== undefined) update.copyId = data.copyId;
  if (data.campaignId !== undefined) update.campaignId = data.campaignId;
  if (data.strategyId !== undefined) update.strategyId = data.strategyId;
  if (data.contactedBy !== undefined) update.contactedBy = data.contactedBy;
  if (data.contactedAt !== undefined) update.contactedAt = new Date(data.contactedAt);
  if (data.lastActivity !== undefined) update.lastActivity = new Date(data.lastActivity);
  if (data.followupStep !== undefined) update.followupStep = data.followupStep;
  if (data.nextFollowup !== undefined) update.nextFollowup = data.nextFollowup ? new Date(data.nextFollowup) : null;
  if (data.convertedToClientId !== undefined) update.convertedToClientId = data.convertedToClientId;
  if (data.convertedAt !== undefined) update.convertedAt = data.convertedAt ? new Date(data.convertedAt) : null;
  if (data.assignedTo !== undefined) update.assignedTo = data.assignedTo;
  if (data.score      !== undefined) update.score      = data.score;
  if (data.socialData     !== undefined) update.socialData     = data.socialData;
  if (data.socialFb       !== undefined) update.socialFb       = data.socialFb;
  if (data.socialIg       !== undefined) update.socialIg       = data.socialIg;
  if (data.approvedForSend !== undefined) update.approvedForSend = data.approvedForSend;

  const [updated] = await db
    .update(mktLeads)
    .set(update as never)
    .where(eq(mktLeads.id, id))
    .returning();

  if (!updated) return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });

  return NextResponse.json(updated);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const apiKeyValid = validateMktApiKey(req);
  if (!apiKeyValid) {
    const { userId } = await auth();
    if (!userId) return unauthorizedResponse();
  }

  const { id } = await params;
  const [lead] = await db.select().from(mktLeads).where(eq(mktLeads.id, id));
  if (!lead) return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });

  return NextResponse.json(lead);
}
