import { NextResponse } from "next/server";
import { db } from "@/db";
import { mktLeads } from "@/db/schema";
import { eq, and, inArray, gte } from "drizzle-orm";
import { validateMktApiKey, unauthorizedResponse } from "@/lib/mkt-auth";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

const bodySchema = z.object({
  leadIds:  z.array(z.string().uuid()).optional(),
  minScore: z.number().int().min(1).max(10).optional(),
  approve:  z.boolean().default(true),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const apiKeyValid = validateMktApiKey(req);
  if (!apiKeyValid) {
    const { userId } = await auth();
    if (!userId) return unauthorizedResponse();
  }

  const { id: campaignId } = await params;
  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { leadIds, minScore, approve } = parsed.data;
  const approvedValue = approve ? 1 : 0;

  if (leadIds?.length) {
    const updated = await db
      .update(mktLeads)
      .set({ approvedForSend: approvedValue, updatedAt: new Date() })
      .where(and(eq(mktLeads.campaignId, campaignId), inArray(mktLeads.id, leadIds)))
      .returning({ id: mktLeads.id });
    return NextResponse.json({ updated: updated.length });
  }

  // Aprobar todos los leads de la campaña (opcionalmente filtrados por score mínimo)
  const conditions = [eq(mktLeads.campaignId, campaignId)];
  if (minScore !== undefined) conditions.push(gte(mktLeads.score, minScore));

  const updated = await db
    .update(mktLeads)
    .set({ approvedForSend: approvedValue, updatedAt: new Date() })
    .where(and(...conditions))
    .returning({ id: mktLeads.id });

  return NextResponse.json({ updated: updated.length });
}
