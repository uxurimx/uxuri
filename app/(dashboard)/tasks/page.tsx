import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import {
  tasks, projects, users, agents, clients, userTaskPreferences,
  workflowColumns, objectives, shares,
} from "@/db/schema";
import { eq, or, and, sql, inArray } from "drizzle-orm";
import { getRole } from "@/lib/auth";
import { getActiveWorkspaceId } from "@/lib/workspace";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { TasksHeader } from "@/components/tasks/tasks-header";

export default async function TasksPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const role = await getRole();
  const isAdmin = role === "admin";
  const wsId = await getActiveWorkspaceId();

  // Projects shared with this user (to include their tasks)
  const sharedProjectLinks = await db
    .select({ resourceId: shares.resourceId, permission: shares.permission })
    .from(shares)
    .where(and(eq(shares.resourceType, "project"), eq(shares.sharedWithId, userId)));
  const sharedProjectIds = sharedProjectLinks.map((s) => s.resourceId);
  const editableSharedProjectIds = sharedProjectLinks
    .filter((s) => s.permission === "edit")
    .map((s) => s.resourceId);

  const wsTaskFilter = wsId ? eq(tasks.workspaceId, wsId) : undefined;
  const wsProjFilter = wsId ? eq(projects.workspaceId, wsId) : undefined;

  const baseTasksWhere = isAdmin
    ? undefined
    : sharedProjectIds.length > 0
      ? or(eq(tasks.createdBy, userId), eq(tasks.assignedTo, userId), inArray(tasks.projectId, sharedProjectIds))
      : or(eq(tasks.createdBy, userId), eq(tasks.assignedTo, userId));

  const tasksWhere = wsTaskFilter
    ? (baseTasksWhere ? and(baseTasksWhere, wsTaskFilter) : wsTaskFilter)
    : baseTasksWhere;

  const baseProjWhere = isAdmin
    ? undefined
    : editableSharedProjectIds.length > 0
      ? or(eq(projects.createdBy, userId), inArray(projects.id, editableSharedProjectIds))
      : eq(projects.createdBy, userId);

  const projWhere = wsProjFilter
    ? (baseProjWhere ? and(baseProjWhere, wsProjFilter) : wsProjFilter)
    : baseProjWhere;

  const [allTasks, allProjects, allUsers, allAgents, allCustomColumns, allClients, allObjectives] =
    await Promise.all([
      db
        .select({
          id: tasks.id,
          title: tasks.title,
          description: tasks.description,
          projectId: tasks.projectId,
          clientId: tasks.clientId,
          assignedTo: tasks.assignedTo,
          agentId: tasks.agentId,
          customColumnId: tasks.customColumnId,
          status: tasks.status,
          priority: tasks.priority,
          dueDate: tasks.dueDate,
          sortOrder: sql<number | null>`COALESCE(${userTaskPreferences.sortOrder}, ${tasks.sortOrder})`,
          createdAt: tasks.createdAt,
          updatedAt: tasks.updatedAt,
          createdBy: tasks.createdBy,
          projectName: projects.name,
          personalDone: sql<boolean>`COALESCE(${userTaskPreferences.personalDone}, false)`,
          workspaceId: tasks.workspaceId,
          subtaskTotal: sql<number>`(SELECT COUNT(*)::int FROM task_subtasks WHERE task_id = ${tasks.id})`,
          subtaskDone:  sql<number>`(SELECT COUNT(*)::int FROM task_subtasks WHERE task_id = ${tasks.id} AND done = true)`,
        })
        .from(tasks)
        .leftJoin(projects, eq(tasks.projectId, projects.id))
        .leftJoin(
          userTaskPreferences,
          and(eq(userTaskPreferences.taskId, tasks.id), eq(userTaskPreferences.userId, userId))
        )
        .where(tasksWhere)
        .orderBy(tasks.createdAt),
      // For the "new task" dropdown: own projects + shared-edit projects
      db
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(projWhere)
        .orderBy(projects.name),
      db.select({ id: users.id, name: users.name }).from(users).orderBy(users.name),
      db
        .select({ id: agents.id, name: agents.name, avatar: agents.avatar, color: agents.color })
        .from(agents)
        .where(
          isAdmin
            ? eq(agents.isActive, true)
            : and(eq(agents.isActive, true), eq(agents.createdBy, userId))
        )
        .orderBy(agents.name),
      db.select({
        id: workflowColumns.id,
        name: workflowColumns.name,
        color: workflowColumns.color,
        sortOrder: workflowColumns.sortOrder,
      }).from(workflowColumns).orderBy(workflowColumns.sortOrder),
      db
        .select({ id: clients.id, name: clients.name })
        .from(clients)
        .where(isAdmin ? undefined : eq(clients.createdBy, userId))
        .orderBy(clients.name),
      db
        .select({ id: objectives.id, title: objectives.title })
        .from(objectives)
        .where(isAdmin ? undefined : eq(objectives.createdBy, userId))
        .orderBy(objectives.createdAt),
    ]);

  return (
    <div className="space-y-6">
      <TasksHeader
        projects={allProjects}
        users={allUsers}
        agents={allAgents}
        clients={allClients}
        objectives={allObjectives}
        currentUserId={userId}
      />
      <KanbanBoard
        initialTasks={allTasks}
        initialCustomColumns={allCustomColumns}
        projects={allProjects}
        users={allUsers}
        agents={allAgents}
        clients={allClients}
        objectives={allObjectives}
        currentUserId={userId}
      />
    </div>
  );
}
