import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { agents, tasks } from "@/db/schema";
import { eq, and, ne, count } from "drizzle-orm";
import { AgentsList } from "@/components/agents/agents-list";

export default async function AgentsPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const agentsWithCount = await db
    .select({
      id: agents.id,
      name: agents.name,
      specialty: agents.specialty,
      description: agents.description,
      avatar: agents.avatar,
      color: agents.color,
      createdBy: agents.createdBy,
      isActive: agents.isActive,
      createdAt: agents.createdAt,
      updatedAt: agents.updatedAt,
      taskCount: count(tasks.id),
    })
    .from(agents)
    .leftJoin(tasks, and(eq(tasks.agentId, agents.id), ne(tasks.status, "done")))
    .where(eq(agents.isActive, true))
    .groupBy(agents.id)
    .orderBy(agents.createdAt);

  return (
    <div className="space-y-6">
      <AgentsList initialAgents={agentsWithCount} currentUserId={userId} />
    </div>
  );
}
