import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import {
  tasks, projects, users, agents, agentSessions, taskActivity,
} from "@/db/schema";
import { eq, and, or, gte, lt, sql, count, isNotNull, desc, not } from "drizzle-orm";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0]; // YYYY-MM-DD for date columns

  const [
    [userRow],
    [doneTodayRow],
    [agentDoneRow],
    myPendingTasks,
    activeProjects,
    completedToday,
    agentActivity,
  ] = await Promise.all([

    // Current user name
    db.select({ name: users.name }).from(users).where(eq(users.id, userId)),

    // Tasks I marked as "done" today (via status_changed activity)
    db
      .select({ count: count() })
      .from(taskActivity)
      .where(
        and(
          sql`${taskActivity.type} = 'status_changed'`,
          eq(taskActivity.newValue, "done"),
          eq(taskActivity.userId, userId),
          gte(taskActivity.createdAt, today),
        )
      ),

    // Tasks completed by agents today (distinct task_id from sessions ended today)
    db
      .select({ count: sql<number>`COUNT(DISTINCT ${agentSessions.taskId})::int` })
      .from(agentSessions)
      .where(
        and(
          sql`${agentSessions.status} = 'done'`,
          isNotNull(agentSessions.endedAt),
          gte(agentSessions.endedAt, today),
        )
      ),

    // My pending tasks: assigned to me OR created by me, not done
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
        projectId: tasks.projectId,
        projectName: projects.name,
        assignedTo: tasks.assignedTo,
        createdBy: tasks.createdBy,
      })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(
        and(
          or(eq(tasks.assignedTo, userId), eq(tasks.createdBy, userId)),
          not(sql`${tasks.status} = 'done'`),
        )
      )
      .orderBy(
        sql`CASE ${tasks.priority} WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END`,
        tasks.dueDate,
        tasks.createdAt,
      )
      .limit(30),

    // Active projects with task progress counts
    db
      .select({
        id: projects.id,
        name: projects.name,
        priority: projects.priority,
        totalTasks: sql<number>`(SELECT COUNT(*)::int FROM tasks WHERE project_id = ${projects.id})`,
        doneTasks:  sql<number>`(SELECT COUNT(*)::int FROM tasks WHERE project_id = ${projects.id} AND status = 'done')`,
      })
      .from(projects)
      .where(eq(projects.status, "active"))
      .limit(6),

    // Tasks completed today with who did it
    db
      .select({
        taskId:      tasks.id,
        taskTitle:   tasks.title,
        taskPriority: tasks.priority,
        completedBy:  taskActivity.userName,
        completedAt:  taskActivity.createdAt,
      })
      .from(taskActivity)
      .leftJoin(tasks, eq(taskActivity.taskId, tasks.id))
      .where(
        and(
          sql`${taskActivity.type} = 'status_changed'`,
          eq(taskActivity.newValue, "done"),
          gte(taskActivity.createdAt, today),
        )
      )
      .orderBy(desc(taskActivity.createdAt))
      .limit(15),

    // Agent activity today: which agents worked and how long
    db
      .select({
        agentName:    agents.name,
        agentAvatar:  agents.avatar,
        agentColor:   agents.color,
        tasksWorked:  sql<number>`COUNT(DISTINCT ${agentSessions.taskId})::int`,
        totalSeconds: sql<number>`COALESCE(SUM(${agentSessions.elapsedSeconds}), 0)::int`,
        sessionsToday: sql<number>`COUNT(*)::int`,
      })
      .from(agentSessions)
      .leftJoin(agents, eq(agentSessions.agentId, agents.id))
      .where(gte(agentSessions.startedAt, today))
      .groupBy(agents.id, agents.name, agents.avatar, agents.color)
      .limit(6),
  ]);

  return (
    <DashboardClient
      userId={userId}
      userName={userRow?.name ?? "Usuario"}
      doneTodayByMe={doneTodayRow?.count ?? 0}
      doneTodayByAgents={agentDoneRow?.count ?? 0}
      myPendingTasks={myPendingTasks}
      activeProjects={activeProjects}
      completedToday={completedToday}
      agentActivity={agentActivity}
      todayStr={todayStr}
    />
  );
}
