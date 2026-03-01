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
  if (!entityId) return NextResponse.json({ error: "Missing entityId" }, { status: 400 });

  const [channel] = await db
    .select()
    .from(chatChannels)
    .where(eq(chatChannels.entityId, entityId));

  return NextResponse.json(channel ?? null);
}
