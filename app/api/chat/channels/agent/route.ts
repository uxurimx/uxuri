import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { chatChannels, agents } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

// GET /api/chat/channels/agent?agentId=xxx
// Find or create a 1-on-1 chat channel between the current user and an agent.
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const agentId = url.searchParams.get("agentId");
  if (!agentId) return NextResponse.json({ error: "Missing agentId" }, { status: 400 });

  // Verify agent exists
  const [agent] = await db.select({ id: agents.id, name: agents.name })
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.isActive, true)));
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  // Stable key: "agent:{agentId}|{userId}"
  const dmKey = `agent:${agentId}|${userId}`;

  const [existing] = await db
    .select()
    .from(chatChannels)
    .where(eq(chatChannels.dmKey, dmKey));

  if (existing) return NextResponse.json(existing);

  const [created] = await db
    .insert(chatChannels)
    .values({
      name: agent.name,
      entityType: "agent-dm",
      agentId,
      dmKey,
      createdBy: userId,
    })
    .returning();

  return NextResponse.json(created);
}
