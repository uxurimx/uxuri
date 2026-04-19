import { NextResponse } from "next/server";
import { db } from "@/db";
import { mktLeads } from "@/db/schema";
import { eq, isNotNull, or } from "drizzle-orm";
import { requireAccess } from "@/lib/auth";

// POST /api/mkt/campaigns/[id]/enrich
// Dispara el enriquecimiento de leads de la campaña en el mkt-server.
// El servidor enriquece cada lead con datos de IG, FB y reseñas de Maps.
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

  // Obtener leads de la campaña que tienen URLs enriquecibles
  const leads = await db
    .select({
      id:       mktLeads.id,
      name:     mktLeads.name,
      website:  mktLeads.website,
      socialIg: mktLeads.socialIg,
      socialFb: mktLeads.socialFb,
      mapsUrl:  mktLeads.menuUrl,   // maps_url se guarda en menu_url por ahora
      rating:   mktLeads.rating,
      reviews:  mktLeads.reviews,
      webSource:mktLeads.webSource,
      city:     mktLeads.city,
      country:  mktLeads.country,
    })
    .from(mktLeads)
    .where(eq(mktLeads.campaignId, id))
    .limit(200);

  if (leads.length === 0) {
    return NextResponse.json({ error: "No hay leads en esta campaña" }, { status: 404 });
  }

  try {
    const res = await fetch(`${serverUrl.replace(/\/$/, "")}/api/enrich`, {
      method:  "POST",
      headers: { "X-API-Key": serverKey, "Content-Type": "application/json" },
      body:    JSON.stringify({
        campaignId: id,
        leads:      leads,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "No se pudo contactar al mkt-server" }, { status: 502 });
  }
}
