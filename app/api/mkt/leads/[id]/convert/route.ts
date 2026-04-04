import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { mktLeads, mktInteractions, clients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const convertSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().nullish(),
  phone: z.string().nullish(),
  company: z.string().nullish(),
  website: z.string().nullish(),
  notes: z.string().nullish(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [lead] = await db.select().from(mktLeads).where(eq(mktLeads.id, id));
  if (!lead) return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });

  if (lead.convertedToClientId) {
    return NextResponse.json({ error: "Este lead ya fue convertido", clientId: lead.convertedToClientId }, { status: 409 });
  }

  const body = await req.json();
  const parsed = convertSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { name, email, phone, company, website, notes } = parsed.data;

  // Crear el cliente
  const [newClient] = await db.insert(clients).values({
    name,
    email: email ?? null,
    phone: phone ?? null,
    company: company ?? null,
    website: website ?? null,
    status: "prospect",
    notes: notes
      ? notes
      : `Lead convertido desde marketing${lead.niche ? ` · ${lead.niche}` : ""}${lead.city ? ` · ${lead.city}` : ""}`,
    createdBy: userId,
  }).returning();

  // Actualizar el lead
  await db.update(mktLeads).set({
    convertedToClientId: newClient.id,
    convertedAt: new Date(),
    status: "cerrado",
    lastActivity: new Date(),
    updatedAt: new Date(),
  }).where(eq(mktLeads.id, id));

  // Registrar interacción
  await db.insert(mktInteractions).values({
    leadId: id,
    type: "converted",
    message: `Convertido al cliente "${newClient.name}"`,
    campaignId: lead.campaignId ?? null,
    workerId: userId,
  });

  return NextResponse.json({ ok: true, client: newClient }, { status: 201 });
}
