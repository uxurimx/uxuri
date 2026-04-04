import { NextResponse } from "next/server";
import { db } from "@/db";
import { mktLeads } from "@/db/schema";
import { validateMktApiKey, unauthorizedResponse } from "@/lib/mkt-auth";
import { z } from "zod";

const leadSchema = z.object({
  sourceId: z.string(),           // ID original del SQLite
  name: z.string().nullish(),
  category: z.string().nullish(),
  niche: z.string().nullish(),
  city: z.string().nullish(),
  country: z.string().nullish(),
  phone: z.string().nullish(),
  email: z.string().nullish(),
  website: z.string().nullish(),
  menuUrl: z.string().nullish(),
  address: z.string().nullish(),
  query: z.string().nullish(),
  rating: z.number().nullish(),
  reviews: z.number().int().nullish(),
  webSource: z.string().nullish(),
  hasWhatsapp: z.number().int().nullish(),  // null | 0 | 1
  score: z.number().int().nullish(),
  socialFb: z.string().nullish(),
  socialIg: z.string().nullish(),
  socialData: z.record(z.unknown()).nullish(),
  status: z.string().nullish(),
  notes: z.string().nullish(),
  templateUsed: z.string().nullish(),
  strategyId: z.string().uuid().nullish(),
  campaignId: z.string().uuid().nullish(),
  copyId: z.string().uuid().nullish(),
  contactedAt: z.string().nullish(),
  lastActivity: z.string().nullish(),
  followupStep: z.number().int().nullish(),
  nextFollowup: z.string().nullish(),
  scrapedAt: z.string().nullish(),
});

const syncBodySchema = z.object({
  leads: z.array(leadSchema),
  scrapedBy: z.string().nullish(),  // userId del worker
});

export async function POST(req: Request) {
  if (!validateMktApiKey(req)) return unauthorizedResponse();

  const body = await req.json();
  const parsed = syncBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { leads, scrapedBy } = parsed.data;

  let inserted = 0;
  const mappings: { sourceId: string; id: string }[] = [];

  // Batch en grupos de 50 para no saturar la conexión
  const BATCH = 50;
  for (let i = 0; i < leads.length; i += BATCH) {
    const batch = leads.slice(i, i + BATCH);

    for (const lead of batch) {
      const values = {
        sourceId: lead.sourceId,
        name: lead.name ?? null,
        category: lead.category ?? null,
        niche: lead.niche ?? null,
        city: lead.city ?? null,
        country: lead.country ?? "México",
        phone: lead.phone ?? null,
        email: lead.email ?? null,
        website: lead.website ?? null,
        menuUrl: lead.menuUrl ?? null,
        address: lead.address ?? null,
        query: lead.query ?? null,
        rating: lead.rating ?? null,
        reviews: lead.reviews ?? null,
        webSource: lead.webSource ?? null,
        hasWhatsapp: lead.hasWhatsapp ?? null,
        score: lead.score ?? null,
        socialFb: lead.socialFb ?? null,
        socialIg: lead.socialIg ?? null,
        socialData: lead.socialData ?? null,
        status: (lead.status as typeof mktLeads.$inferInsert["status"]) ?? "nuevo",
        notes: lead.notes ?? null,
        templateUsed: lead.templateUsed ?? null,
        strategyId: lead.strategyId ?? null,
        campaignId: lead.campaignId ?? null,
        copyId: lead.copyId ?? null,
        contactedAt: lead.contactedAt ? new Date(lead.contactedAt) : null,
        lastActivity: lead.lastActivity ? new Date(lead.lastActivity) : null,
        followupStep: lead.followupStep ?? 0,
        nextFollowup: lead.nextFollowup ? new Date(lead.nextFollowup) : null,
        scrapedBy: scrapedBy ?? null,
        scrapedAt: lead.scrapedAt ? new Date(lead.scrapedAt) : new Date(),
      };

      const result = await db
        .insert(mktLeads)
        .values(values)
        .onConflictDoUpdate({
          target: mktLeads.sourceId,
          set: {
            name: values.name,
            phone: values.phone,
            email: values.email,
            status: values.status,
            hasWhatsapp: values.hasWhatsapp,
            score: values.score,
            notes: values.notes,
            templateUsed: values.templateUsed,
            contactedAt: values.contactedAt,
            lastActivity: values.lastActivity,
            followupStep: values.followupStep,
            nextFollowup: values.nextFollowup,
            socialFb: values.socialFb,
            socialIg: values.socialIg,
            socialData: values.socialData,
            updatedAt: new Date(),
          },
        })
        .returning({ id: mktLeads.id, sourceId: mktLeads.sourceId });

      if (result.length > 0) {
        inserted++;
        mappings.push({ sourceId: result[0].sourceId!, id: result[0].id });
      }
    }
  }

  return NextResponse.json({ ok: true, total: leads.length, processed: inserted, mappings });
}
