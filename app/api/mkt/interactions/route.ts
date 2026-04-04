import { NextResponse } from "next/server";
import { db } from "@/db";
import { mktInteractions, mktLeads } from "@/db/schema";
import { eq } from "drizzle-orm";
import { validateMktApiKey, unauthorizedResponse } from "@/lib/mkt-auth";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { pusherServer } from "@/lib/pusher";

const createSchema = z.object({
  leadId: z.string().uuid().nullish(),
  sourceLeadId: z.string().nullish(),  // SQLite ID — alternative to leadId
  type: z.enum([
    "scraped", "sent", "replied", "followup_sent", "followup_replied",
    "interested", "not_interested", "call", "meeting", "converted", "lost", "note",
  ]),
  message: z.string().nullish(),
  copyId: z.string().uuid().nullish(),
  campaignId: z.string().uuid().nullish(),
  workerId: z.string().nullish(),
  // Actualizar lastActivity del lead automáticamente
  updateLeadStatus: z.string().nullish(),
});

export async function POST(req: Request) {
  const apiKeyValid = validateMktApiKey(req);
  let userId: string | null = null;
  if (!apiKeyValid) {
    const clerk = await auth();
    userId = clerk.userId;
    if (!userId) return unauthorizedResponse();
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let { leadId, sourceLeadId, type, message, copyId, campaignId, workerId, updateLeadStatus } = parsed.data;

  // Resolve sourceLeadId → leadId if needed
  if (!leadId && sourceLeadId) {
    const [found] = await db
      .select({ id: mktLeads.id })
      .from(mktLeads)
      .where(eq(mktLeads.sourceId, sourceLeadId));
    if (!found) return NextResponse.json({ error: "Lead no encontrado por sourceLeadId" }, { status: 404 });
    leadId = found.id;
  }
  if (!leadId) return NextResponse.json({ error: "leadId o sourceLeadId requerido" }, { status: 400 });

  const [interaction] = await db.insert(mktInteractions).values({
    leadId,
    type,
    message: message ?? null,
    copyId: copyId ?? null,
    campaignId: campaignId ?? null,
    workerId: workerId ?? userId ?? null,
  }).returning();

  // Actualizar lastActivity y status del lead si se indica
  const leadUpdate: Record<string, unknown> = {
    lastActivity: new Date(),
    updatedAt: new Date(),
  };
  if (updateLeadStatus) leadUpdate.status = updateLeadStatus;
  if (type === "sent") {
    leadUpdate.contactedAt = new Date();
    if (!updateLeadStatus) leadUpdate.status = "contactado";
  }
  if (type === "replied" || type === "interested") {
    if (!updateLeadStatus) leadUpdate.status = type === "interested" ? "interesado" : "contactado";
  }

  await db.update(mktLeads).set(leadUpdate as never).where(eq(mktLeads.id, leadId));

  // Notificar en tiempo real al dashboard de marketing
  pusherServer.trigger("marketing-activity", "lead:activity", {
    leadId,
    type,
    campaignId: campaignId ?? null,
    timestamp: interaction.createdAt,
  }).catch(() => {});

  return NextResponse.json(interaction, { status: 201 });
}

export async function GET(req: Request) {
  const apiKeyValid = validateMktApiKey(req);
  if (!apiKeyValid) {
    const { userId } = await auth();
    if (!userId) return unauthorizedResponse();
  }

  const url = new URL(req.url);
  const leadId = url.searchParams.get("leadId");
  if (!leadId) return NextResponse.json({ error: "leadId requerido" }, { status: 400 });

  const rows = await db
    .select()
    .from(mktInteractions)
    .where(eq(mktInteractions.leadId, leadId))
    .orderBy(mktInteractions.createdAt);

  return NextResponse.json(rows);
}
