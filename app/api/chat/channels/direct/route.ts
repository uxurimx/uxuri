import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { chatChannels, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const otherUserId = url.searchParams.get("otherUserId");
  if (!otherUserId) return NextResponse.json({ error: "Missing otherUserId" }, { status: 400 });

  const dmKey = [userId, otherUserId].sort().join("|");

  // Find existing DM channel
  const [existing] = await db
    .select()
    .from(chatChannels)
    .where(eq(chatChannels.dmKey, dmKey));

  if (existing) return NextResponse.json(existing);

  // Get the other user's name for the channel name
  const [otherUser] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, otherUserId));

  const [me] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId));

  const channelName = [me?.name ?? "Yo", otherUser?.name ?? "Usuario"].join(" & ");

  const [created] = await db
    .insert(chatChannels)
    .values({
      name: channelName,
      entityType: "direct",
      dmKey,
      createdBy: userId,
    })
    .returning();

  return NextResponse.json(created);
}
