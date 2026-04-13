import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { clients, businesses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateStageSchema = z.object({
  clientId: z.string().uuid(),
  pipelineStage: z.enum([
    "contacto", "lead", "prospecto", "propuesta", "negociacion",
    "cliente", "recurrente", "churned",
  ]),
});

// GET /api/clients/pipeline — todos los clientes con su stage y negocio origen
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: clients.id,
      name: clients.name,
      email: clients.email,
      phone: clients.phone,
      company: clients.company,
      status: clients.status,
      pipelineStage: clients.pipelineStage,
      sourceBusinessId: clients.sourceBusinessId,
      sourceChannel: clients.sourceChannel,
      firstContactDate: clients.firstContactDate,
      estimatedValue: clients.estimatedValue,
      notes: clients.notes,
      createdAt: clients.createdAt,
      // Nombre del negocio origen
      sourceBizName: businesses.name,
      sourceBizLogo: businesses.logo,
    })
    .from(clients)
    .leftJoin(businesses, eq(clients.sourceBusinessId, businesses.id))
    .orderBy(clients.createdAt);

  return NextResponse.json(rows);
}

// PATCH /api/clients/pipeline — mover cliente en el pipeline
export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = updateStageSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Cuando llega a "cliente", actualizar también el status principal
  const extraFields =
    parsed.data.pipelineStage === "cliente" || parsed.data.pipelineStage === "recurrente"
      ? { status: "active" as const }
      : parsed.data.pipelineStage === "churned"
      ? { status: "inactive" as const }
      : {};

  const [updated] = await db
    .update(clients)
    .set({
      pipelineStage: parsed.data.pipelineStage,
      ...extraFields,
      updatedAt: new Date(),
    })
    .where(eq(clients.id, parsed.data.clientId))
    .returning();

  return NextResponse.json(updated);
}
