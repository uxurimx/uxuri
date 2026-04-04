import { NextResponse } from "next/server";
import { db } from "@/db";
import { mktLeads } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { validateMktApiKey, unauthorizedResponse } from "@/lib/mkt-auth";
import { auth } from "@clerk/nextjs/server";

export async function GET(req: Request) {
  // Acepta tanto API Key (Python app) como sesión Clerk (dashboard web)
  const apiKeyValid = validateMktApiKey(req);
  if (!apiKeyValid) {
    const { userId } = await auth();
    if (!userId) return unauthorizedResponse();
  }

  const url = new URL(req.url);
  const niche = url.searchParams.get("niche");
  const city = url.searchParams.get("city");
  const status = url.searchParams.get("status");
  const campaignId = url.searchParams.get("campaignId");
  const strategyId = url.searchParams.get("strategyId");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100"), 500);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");

  const conditions = [];
  if (niche) conditions.push(eq(mktLeads.niche, niche));
  if (city) conditions.push(eq(mktLeads.city, city));
  if (status) conditions.push(eq(mktLeads.status, status as never));
  if (campaignId) conditions.push(eq(mktLeads.campaignId, campaignId));
  if (strategyId) conditions.push(eq(mktLeads.strategyId, strategyId));

  const rows = await db
    .select()
    .from(mktLeads)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(mktLeads.createdAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json(rows);
}
