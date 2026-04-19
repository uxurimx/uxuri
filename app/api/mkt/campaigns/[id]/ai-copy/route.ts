import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/auth";

// POST /api/mkt/campaigns/[id]/ai-copy
// Dispara generación de copy personalizado con AI para los leads enriquecidos de la campaña.
export async function POST(
  req: Request,
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

  const body = await req.json().catch(() => ({}));
  const framework = body.framework ?? "AIDA";
  const variants  = body.variants  ?? 2;
  const baseCopy  = body.baseCopy  ?? null;

  try {
    const res = await fetch(`${serverUrl.replace(/\/$/, "")}/api/generate-copy`, {
      method:  "POST",
      headers: { "X-API-Key": serverKey, "Content-Type": "application/json" },
      body:    JSON.stringify({ campaignId: id, framework, variants, baseCopy }),
      signal:  AbortSignal.timeout(10_000),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "No se pudo contactar al mkt-server" }, { status: 502 });
  }
}
