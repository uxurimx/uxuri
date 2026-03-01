import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { agents, tasks, projects, agentSessions } from "@/db/schema";
import { eq, and, ne, or, gte, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AgentPanel } from "@/components/agents/agent-panel";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) return null;

  const { id } = await params;

  // Agent info
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, id), eq(agents.isActive, true)));

  if (!agent) notFound();

  // Active tasks assigned to this agent (not done)
  const agentTasks = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      priority: tasks.priority,
      dueDate: tasks.dueDate,
      projectName: projects.name,
      projectId: tasks.projectId,
      agentStatus: tasks.agentStatus,
    })
    .from(tasks)
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .where(and(eq(tasks.agentId, id), ne(tasks.status, "done")))
    .orderBy(tasks.createdAt);

  // Active sessions (running or paused) for this agent
  const activeSessions = await db
    .select({
      id: agentSessions.id,
      taskId: agentSessions.taskId,
      startedAt: agentSessions.startedAt,
      elapsedSeconds: agentSessions.elapsedSeconds,
      status: agentSessions.status,
    })
    .from(agentSessions)
    .where(
      and(
        eq(agentSessions.agentId, id),
        or(eq(agentSessions.status, "running"), eq(agentSessions.status, "paused"))
      )
    );

  // Total done-session seconds per task (for active tasks)
  const doneTimeRows = await db
    .select({
      taskId: agentSessions.taskId,
      totalSeconds: sql<number>`COALESCE(SUM(${agentSessions.elapsedSeconds}), 0)::int`,
    })
    .from(agentSessions)
    .where(and(eq(agentSessions.agentId, id), eq(agentSessions.status, "done")))
    .groupBy(agentSessions.taskId);

  const doneTimes: Record<string, number> = Object.fromEntries(
    doneTimeRows.map((r) => [r.taskId, r.totalSeconds])
  );

  // Today's accumulated seconds from done sessions
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [todayRow] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${agentSessions.elapsedSeconds}), 0)::int`,
    })
    .from(agentSessions)
    .where(
      and(
        eq(agentSessions.agentId, id),
        eq(agentSessions.status, "done"),
        gte(agentSessions.createdAt, todayStart)
      )
    );

  // History: done sessions grouped by task
  const historyRows = await db
    .select({
      taskId: agentSessions.taskId,
      taskTitle: tasks.title,
      taskStatus: tasks.status,
      taskPriority: tasks.priority,
      projectName: projects.name,
      projectId: tasks.projectId,
      totalSeconds: sql<number>`COALESCE(SUM(${agentSessions.elapsedSeconds}), 0)::int`,
      totalTokens: sql<number>`COALESCE(SUM(${agentSessions.tokenCost}), 0)::int`,
      sessionCount: sql<number>`COUNT(*)::int`,
      lastWorked: sql<string>`MAX(${agentSessions.endedAt})`,
    })
    .from(agentSessions)
    .innerJoin(tasks, eq(agentSessions.taskId, tasks.id))
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .where(and(eq(agentSessions.agentId, id), eq(agentSessions.status, "done")))
    .groupBy(
      agentSessions.taskId,
      tasks.id,
      tasks.title,
      tasks.status,
      tasks.priority,
      tasks.projectId,
      projects.name
    )
    .orderBy(sql`MAX(${agentSessions.endedAt}) DESC`);

  const initialSessions = activeSessions.map((s) => ({
    ...s,
    startedAt: s.startedAt.toISOString(),
    status: s.status as "running" | "paused",
  }));

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div className="flex items-center gap-3">
        <Link
          href="/agents"
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <span className="text-sm text-slate-400">Agentes</span>
      </div>

      {/* Agent header */}
      <div
        className="rounded-2xl p-6 flex items-center gap-5"
        style={{ backgroundColor: agent.color + "12", borderLeft: `4px solid ${agent.color}` }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
          style={{ backgroundColor: agent.color + "20" }}
        >
          {agent.avatar}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{agent.name}</h1>
          {agent.specialty && (
            <p className="text-slate-500 text-sm mt-0.5">{agent.specialty}</p>
          )}
          {agent.description && (
            <p className="text-slate-400 text-sm mt-1 max-w-xl">{agent.description}</p>
          )}
        </div>
      </div>

      {/* Tabs panel */}
      <AgentPanel
        agentId={agent.id}
        agentName={agent.name}
        agentConfig={{
          aiModel: agent.aiModel,
          aiPrompt: agent.aiPrompt,
          maxTokens: agent.maxTokens,
          temperature: agent.temperature,
        }}
        initialTasks={agentTasks}
        initialSessions={initialSessions}
        doneTimes={doneTimes}
        initialTodaySeconds={todayRow?.total ?? 0}
        historyItems={historyRows.map((r) => ({
          taskId: r.taskId,
          taskTitle: r.taskTitle,
          taskStatus: r.taskStatus,
          taskPriority: r.taskPriority,
          projectName: r.projectName ?? null,
          projectId: r.projectId ?? null,
          totalSeconds: r.totalSeconds,
          totalTokens: r.totalTokens,
          sessionCount: r.sessionCount,
          lastWorked: r.lastWorked ?? null,
        }))}
      />
    </div>
  );
}
