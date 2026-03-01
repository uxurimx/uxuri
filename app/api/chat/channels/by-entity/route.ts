import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { chatChannels } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const entityId = url.searchParams.get("entityId");
  const entityType = url.searchParams.get("entityType") as "client" | "project" | null;
  const entityName = url.searchParams.get("entityName");

  if (!entityId) return NextResponse.json({ error: "Missing entityId" }, { status: 400 });

  const [channel] = await db
    .select()
    .from(chatChannels)
    .where(eq(chatChannels.entityId, entityId));

  if (channel) return NextResponse.json(channel);

  // Channel doesn't exist yet (entity was created before this feature).
  // Auto-create it now if we have enough info.
  if (!entityType || !entityName) {
    return NextResponse.json(null);
  }

  const [created] = await db
    .insert(chatChannels)
    .values({
      name: entityName,
      entityType,
      entityId,
      createdBy: userId,
    })
    .returning();

  return NextResponse.json(created);
}
