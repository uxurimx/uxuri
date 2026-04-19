import { NextResponse } from "next/server";
import { db } from "@/db";
import { mktLeads, mktCampaigns, mktCopies } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAccess } from "@/lib/auth";

// POST /api/mkt/leads/[id]/send-wa
// Envía un WhatsApp individual a un lead a través del mkt-server.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAccess("/marketing");
  const { id } = await params;

  const [lead] = await db.select().from(mktLeads).where(eq(mktLeads.id, id));
  if (!lead) return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });
  if (!lead.phone) return NextResponse.json({ error: "Lead sin teléfono" }, { status: 422 });

  // Obtener copy de la campaña si existe
  let copyBody: string | null = null;
  if (lead.campaignId) {
    const [campaign] = await db
      .select({ copyId: mktCampaigns.copyId })
      .from(mktCampaigns)
      .where(eq(mktCampaigns.id, lead.campaignId));
    if (campaign?.copyId) {
      const [copy] = await db
        .select({ content: mktCopies.content })
        .from(mktCopies)
        .where(eq(mktCopies.id, campaign.copyId));
      copyBody = copy?.content ?? null;
    }
  }

  // Permitir override de copy en el body de la request
  const body = await req.json().catch(() => ({}));
  const message = body.message ?? copyBody;

  const serverUrl = process.env.MKT_SERVER_URL;
  const serverKey = process.env.MKT_SERVER_KEY;

  if (!serverUrl || !serverKey) {
    return NextResponse.json({ error: "mkt-server no configurado" }, { status: 503 });
  }

  const res = await fetch(`${serverUrl.replace(/\/$/, "")}/api/leads/${id}/send`, {
    method:  "POST",
    headers: { "X-API-Key": serverKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      lead:    { id: lead.id, phone: lead.phone, name: lead.name, city: lead.city, niche: lead.niche },
      message: message ?? undefined,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "unknown error");
    return NextResponse.json({ error: `mkt-server: ${err}` }, { status: res.status });
  }

  const result = await res.json();
  return NextResponse.json(result);
}
