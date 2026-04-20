import { NextResponse } from "next/server";
import { db } from "@/db";
import { mktLeads } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAccess } from "@/lib/auth";

// POST /api/mkt/leads/[id]/enrich
// Dispara enriquecimiento de un lead individual en el mkt-server.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAccess("/marketing");
  const { id } = await params;

  const serverUrl = process.env.MKT_SERVER_URL;
  const serverKey = process.env.MKT_SERVER_KEY;
  if (!serverUrl || !serverKey) {
    return NextResponse.json(
      { error: "MKT_SERVER_URL o MKT_SERVER_KEY no configurados" },
      { status: 503 }
    );
  }

  const [lead] = await db
    .select({
      id:        mktLeads.id,
      name:      mktLeads.name,
      website:   mktLeads.website,
      socialIg:  mktLeads.socialIg,
      socialFb:  mktLeads.socialFb,
      mapsUrl:   mktLeads.menuUrl,
      rating:    mktLeads.rating,
      reviews:   mktLeads.reviews,
      webSource: mktLeads.webSource,
      city:      mktLeads.city,
      country:   mktLeads.country,
    })
    .from(mktLeads)
    .where(eq(mktLeads.id, id));

  if (!lead) {
    return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });
  }

  try {
    const res = await fetch(`${serverUrl.replace(/\/$/, "")}/api/enrich`, {
      method:  "POST",
      headers: { "X-API-Key": serverKey, "Content-Type": "application/json" },
      body:    JSON.stringify({ leads: [lead] }),
      signal:  AbortSignal.timeout(10_000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "No se pudo contactar al mkt-server" }, { status: 502 });
  }
}
