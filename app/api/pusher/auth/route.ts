import { auth } from "@clerk/nextjs/server";
import { pusherServer } from "@/lib/pusher";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { mobileConversationMembers } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.text();
  const params = new URLSearchParams(body);
  const socketId = params.get("socket_id");
  const channel = params.get("channel_name");

  if (!socketId || !channel) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  if (channel.startsWith("private-user-") && !channel.endsWith(userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (channel.startsWith("private-mobile-conversation-")) {
    const conversationId = channel.replace("private-mobile-conversation-", "");
    const [member] = await db
      .select({ id: mobileConversationMembers.id })
      .from(mobileConversationMembers)
      .where(
        and(
          eq(mobileConversationMembers.conversationId, conversationId),
          eq(mobileConversationMembers.userId, userId)
        )
      );
    if (!member) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const authResponse = pusherServer.authorizeChannel(socketId, channel);
  return NextResponse.json(authResponse);
}
