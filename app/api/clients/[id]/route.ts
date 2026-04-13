import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getRole } from "@/lib/auth";

const updateClientSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  company: z.string().optional(),
  status: z.enum(["active", "inactive", "prospect"]).optional(),
  notes: z.string().optional(),
  website: z.string().optional().nullable(),
  registrationDate: z.string().optional().nullable(),
  businessId: z.string().uuid().optional().nullable(),
  // CRM Pipeline
  pipelineStage: z.enum([
    "contacto", "lead", "prospecto", "propuesta", "negociacion",
    "cliente", "recurrente", "churned",
  ]).optional().nullable(),
  sourceBusinessId: z.string().uuid().optional().nullable(),
  sourceChannel: z.enum([
    "whatsapp", "instagram", "facebook", "referral", "web", "directo", "email", "otro",
  ]).optional().nullable(),
  firstContactDate: z.string().optional().nullable(),
  estimatedValue: z.string().optional().nullable(),
});

async function getClientWithAccess(id: string, userId: string) {
  const [client] = await db.select().from(clients).where(eq(clients.id, id));
  if (!client) return { client: null, allowed: false };
  const role = await getRole();
  const allowed = role === "admin" || client.createdBy === userId;
  return { client, allowed };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { client, allowed } = await getClientWithAccess(id, userId);
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json(client);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { client, allowed } = await getClientWithAccess(id, userId);
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = updateClientSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [updated] = await db.update(clients)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(clients.id, id))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { client, allowed } = await getClientWithAccess(id, userId);
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.delete(clients).where(eq(clients.id, id));
  return NextResponse.json({ success: true });
}
