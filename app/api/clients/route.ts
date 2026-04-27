import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { clients, chatChannels } from "@/db/schema";
import { ensureUser } from "@/lib/ensure-user";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getRole } from "@/lib/auth";
import { resolveNewWorkspaceId, workspaceFilter } from "@/lib/workspace-filter";

const createClientSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  company: z.string().optional(),
  status: z.enum(["active", "inactive", "prospect"]).optional(),
  notes: z.string().optional(),
  // CRM Pipeline
  pipelineStage: z.enum([
    "contacto", "lead", "prospecto", "propuesta", "negociacion",
    "cliente", "recurrente", "churned",
  ]).optional(),
  sourceBusinessId: z.string().uuid().optional(),
  sourceChannel: z.enum([
    "whatsapp", "instagram", "facebook", "referral", "web", "directo", "email", "otro",
  ]).optional(),
  firstContactDate: z.string().optional(),
  estimatedValue: z.string().optional(),
});

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getRole();
  const isAdmin = role === "admin";
  const wsFilter = await workspaceFilter(clients.workspaceId);

  const conditions = [];
  if (!isAdmin) conditions.push(eq(clients.createdBy, userId));
  if (wsFilter) conditions.push(wsFilter);
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const result = whereClause
    ? await db.select().from(clients).where(whereClause).orderBy(clients.createdAt)
    : await db.select().from(clients).orderBy(clients.createdAt);

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureUser(userId);

  const body = await req.json();
  const parsed = createClientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const workspaceId = await resolveNewWorkspaceId();
  const [client] = await db.insert(clients).values({
    ...parsed.data,
    email: parsed.data.email || null,
    createdBy: userId,
    workspaceId,
  }).returning();

  await db.insert(chatChannels).values({
    name: client.name,
    entityType: "client",
    entityId: client.id,
    createdBy: userId,
  }).onConflictDoNothing();

  return NextResponse.json(client, { status: 201 });
}
