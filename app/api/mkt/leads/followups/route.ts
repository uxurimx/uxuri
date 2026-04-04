import { NextResponse } from "next/server";
import { db } from "@/db";
import { mktLeads } from "@/db/schema";
import { eq, and, lte, isNotNull, or, isNull, sql } from "drizzle-orm";
import { validateMktApiKey, unauthorizedResponse } from "@/lib/mkt-auth";
import { auth } from "@clerk/nextjs/server";

export async function GET(req: Request) {
  const apiKeyValid = validateMktApiKey(req);
  if (!apiKeyValid) {
    const { userId } = await auth();
    if (!userId) return unauthorizedResponse();
  }

  const url = new URL(req.url);
  const days = parseInt(url.searchParams.get("days") ?? "3");
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  // Leads en status 'contactado' sin respuesta hace más de N días
  // y cuyo next_followup ya pasó (o no tiene)
  const rows = await db
    .select()
    .from(mktLeads)
    .where(
      and(
        eq(mktLeads.status, "contactado"),
        isNotNull(mktLeads.contactedAt),
        lte(mktLeads.contactedAt, cutoff),
        sql`${mktLeads.hasWhatsapp} != 0`,
        or(
          isNull(mktLeads.nextFollowup),
          lte(mktLeads.nextFollowup, new Date()),
        ),
      )
    )
    .orderBy(mktLeads.contactedAt);

  return NextResponse.json(rows);
}
