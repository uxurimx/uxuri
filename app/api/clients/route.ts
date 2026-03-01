import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { clients, chatChannels } from "@/db/schema";
import { ensureUser } from "@/lib/ensure-user";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const createClientSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  company: z.string().optional(),
  status: z.enum(["active", "inactive", "prospect"]).optional(),
  notes: z.string().optional(),
});

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await db.select().from(clients).orderBy(clients.createdAt);
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

  const [client] = await db.insert(clients).values({
    ...parsed.data,
    email: parsed.data.email || null,
    createdBy: userId,
  }).returning();

  // Auto-create a chat channel for this client
  await db.insert(chatChannels).values({
    name: client.name,
    entityType: "client",
    entityId: client.id,
    createdBy: userId,
  }).onConflictDoNothing();

  return NextResponse.json(client, { status: 201 });
}
