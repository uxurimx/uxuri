import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { chatChannels } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

// Ensure a "General" channel always exists — called on every GET
async function ensureGeneralChannel(userId: string) {
  const [existing] = await db
    .select({ id: chatChannels.id })
    .from(chatChannels)
    .where(eq(chatChannels.entityType, "general"))
    .limit(1);
  if (!existing) {
    await db.insert(chatChannels).values({
      name: "General",
      entityType: "general",
      createdBy: userId,
    });
  }
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureGeneralChannel(userId);

  const channels = await db
    .select()
    .from(chatChannels)
    .orderBy(asc(chatChannels.createdAt));

  // Filter out DM / agent-dm channels the current user is not part of
  const visible = channels.filter((ch) => {
    if (ch.entityType !== "direct" && ch.entityType !== "agent-dm") return true;
    return ch.dmKey?.split("|").includes(userId) ?? false;
  });

  return NextResponse.json(visible);
}

const createChannelSchema = z.object({
  name: z.string().min(1),
  entityType: z.enum(["general", "client", "project"]).optional(),
  entityId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createChannelSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Avoid duplicate channels for same entity
  if (parsed.data.entityId) {
    const [existing] = await db
      .select({ id: chatChannels.id })
      .from(chatChannels)
      .where(eq(chatChannels.entityId, parsed.data.entityId));
    if (existing) return NextResponse.json(existing);
  }

  const [channel] = await db
    .insert(chatChannels)
    .values({
      name: parsed.data.name,
      entityType: parsed.data.entityType ?? "general",
      entityId: parsed.data.entityId ?? null,
      createdBy: userId,
    })
    .returning();

  return NextResponse.json(channel, { status: 201 });
}
