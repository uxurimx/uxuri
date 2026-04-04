import { NextResponse } from "next/server";
import { db } from "@/db";
import { mktLeads } from "@/db/schema";
import { eq } from "drizzle-orm";
import { validateMktApiKey, unauthorizedResponse } from "@/lib/mkt-auth";
import { z } from "zod";

const patchSchema = z.object({
  // Campos de perfil — actualizables desde el EditDialog de mkt
  name: z.string().nullish(),
  phone: z.string().nullish(),
  email: z.string().nullish(),
  website: z.string().nullish(),
  // Campos operacionales
  status: z.string().nullish(),
  hasWhatsapp: z.number().int().nullish(),
  templateUsed: z.string().nullish(),
  lastActivity: z.string().nullish(),
  contactedAt: z.string().nullish(),
  followupStep: z.number().int().nullish(),
  nextFollowup: z.string().nullish(),
  notes: z.string().nullish(),
  campaignId: z.string().uuid().nullish(),
  strategyId: z.string().uuid().nullish(),
  copyId: z.string().uuid().nullish(),
  score: z.number().int().nullish(),
  socialFb: z.string().nullish(),
  socialIg: z.string().nullish(),
  socialData: z.record(z.unknown()).nullish(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  if (!validateMktApiKey(req)) return unauthorizedResponse();

  const { sourceId } = await params;

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const update: Record<string, unknown> = { updatedAt: new Date() };

  if (data.name !== undefined)         update.name = data.name;
  if (data.phone !== undefined)        update.phone = data.phone;
  if (data.email !== undefined)        update.email = data.email;
  if (data.website !== undefined)      update.website = data.website;
  if (data.status !== undefined)       update.status = data.status;
  if (data.hasWhatsapp !== undefined)  update.hasWhatsapp = data.hasWhatsapp;
  if (data.templateUsed !== undefined) update.templateUsed = data.templateUsed;
  if (data.followupStep !== undefined) update.followupStep = data.followupStep;
  if (data.notes !== undefined)        update.notes = data.notes;
  if (data.campaignId !== undefined)   update.campaignId = data.campaignId;
  if (data.strategyId !== undefined)   update.strategyId = data.strategyId;
  if (data.copyId !== undefined)       update.copyId = data.copyId;
  if (data.score !== undefined)        update.score = data.score;
  if (data.socialFb !== undefined)     update.socialFb = data.socialFb;
  if (data.socialIg !== undefined)     update.socialIg = data.socialIg;
  if (data.socialData !== undefined)   update.socialData = data.socialData;
  if (data.lastActivity)   update.lastActivity = new Date(data.lastActivity);
  if (data.contactedAt)    update.contactedAt = new Date(data.contactedAt);
  if (data.nextFollowup)   update.nextFollowup = new Date(data.nextFollowup);

  const [updated] = await db
    .update(mktLeads)
    .set(update as never)
    .where(eq(mktLeads.sourceId, sourceId))
    .returning({ id: mktLeads.id, sourceId: mktLeads.sourceId });

  if (!updated) {
    return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

// GET: resolve sourceId → neonId
export async function GET(
  req: Request,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  if (!validateMktApiKey(req)) return unauthorizedResponse();

  const { sourceId } = await params;

  const [lead] = await db
    .select({ id: mktLeads.id, sourceId: mktLeads.sourceId })
    .from(mktLeads)
    .where(eq(mktLeads.sourceId, sourceId));

  if (!lead) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(lead);
}
