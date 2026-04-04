import { NextResponse } from "next/server";
import { db } from "@/db";
import { mktLeads } from "@/db/schema";
import { eq, and, desc, ilike, or, isNull, isNotNull, count, sql } from "drizzle-orm";
import { validateMktApiKey, unauthorizedResponse } from "@/lib/mkt-auth";
import { auth } from "@clerk/nextjs/server";

export async function GET(req: Request) {
  const apiKeyValid = validateMktApiKey(req);
  if (!apiKeyValid) {
    const { userId } = await auth();
    if (!userId) return unauthorizedResponse();
  }

  const url = new URL(req.url);
  const niche      = url.searchParams.get("niche");
  const city       = url.searchParams.get("city");
  const status     = url.searchParams.get("status");
  const campaignId = url.searchParams.get("campaignId");
  const strategyId = url.searchParams.get("strategyId");
  const q          = url.searchParams.get("q");
  const hasWa      = url.searchParams.get("hasWhatsapp"); // "yes" | "no" | "unknown"
  const withCount  = url.searchParams.get("withCount") === "true";
  const limit      = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 500);
  const offset     = parseInt(url.searchParams.get("offset") ?? "0");

  const conditions = [];
  if (niche)      conditions.push(eq(mktLeads.niche, niche));
  if (city)       conditions.push(eq(mktLeads.city, city));
  if (status)     conditions.push(eq(mktLeads.status, status as never));
  if (campaignId) conditions.push(eq(mktLeads.campaignId, campaignId));
  if (strategyId) conditions.push(eq(mktLeads.strategyId, strategyId));
  if (q) {
    conditions.push(or(
      ilike(mktLeads.name, `%${q}%`),
      ilike(mktLeads.phone, `%${q}%`),
      ilike(mktLeads.email, `%${q}%`),
    ));
  }
  if (hasWa === "yes")     conditions.push(eq(mktLeads.hasWhatsapp, 1));
  if (hasWa === "no")      conditions.push(eq(mktLeads.hasWhatsapp, 0));
  if (hasWa === "unknown") conditions.push(isNull(mktLeads.hasWhatsapp));

  const where = conditions.length ? and(...conditions) : undefined;

  if (withCount) {
    const [rows, [{ total }]] = await Promise.all([
      db.select().from(mktLeads).where(where).orderBy(desc(mktLeads.lastActivity), desc(mktLeads.createdAt)).limit(limit).offset(offset),
      db.select({ total: count() }).from(mktLeads).where(where),
    ]);
    return NextResponse.json({ rows, total });
  }

  const rows = await db
    .select()
    .from(mktLeads)
    .where(where)
    .orderBy(desc(mktLeads.lastActivity), desc(mktLeads.createdAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json(rows);
}
