import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { projects, clients, tasks, users, agents, userTaskPreferences, workflowColumns, objectives, accounts, businesses, businessMembers } from "@/db/schema";
import { eq, or, and, sql, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { canAccess } from "@/lib/access";
import { ProjectDetail } from "@/components/projects/project-detail";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) return null;

  const { id } = await params;

  // Access check
  const [projectCheck] = await db
    .select({ createdBy: projects.createdBy })
    .from(projects)
    .where(eq(projects.id, id));
  if (!projectCheck) notFound();
  const hasAccess = await canAccess(userId, "project", id, projectCheck.createdBy, "view");
  if (!hasAccess) notFound();
  // Cualquier persona con acceso al proyecto puede editar tareas (cambiar estado, descripción)
  const canEditTasks = true; // hasAccess ya garantiza que el usuario tiene al menos "view" share

  const [[project], rawTasks, allProjects, allUsers, allAgents, allCustomColumns, allClients, allObjectives] = await Promise.all([
    db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        clientId: projects.clientId,
        status: projects.status,
        priority: projects.priority,
        privacy: projects.privacy,
        range: projects.range,
        category: projects.category,
        startDate: projects.startDate,
        endDate: projects.endDate,
        createdAt: projects.createdAt,
        createdBy: projects.createdBy,
        clientName: clients.name,
        cycleMinutes:  projects.cycleMinutes,
        lastCycleAt: projects.lastCycleAt,
        nextCycleAt: projects.nextCycleAt,
        momentum:    projects.momentum,
        totalAmount: projects.totalAmount,
        currency:    projects.currency,
        paymentType: projects.paymentType,
      })
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .where(eq(projects.id, id)),
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
        personalDone: sql<boolean>`COALESCE(${userTaskPreferences.personalDone}, false)`,
        subtaskTotal: sql<number>`(SELECT COUNT(*)::int FROM task_subtasks WHERE task_id = ${tasks.id})`,
        subtaskDone:  sql<number>`(SELECT COUNT(*)::int FROM task_subtasks WHERE task_id = ${tasks.id} AND done = true)`,
      })
      .from(tasks)
      .leftJoin(
        userTaskPreferences,
        and(
          eq(userTaskPreferences.taskId, tasks.id),
          eq(userTaskPreferences.userId, userId),
        )
      )
      .where(eq(tasks.projectId, id)),
    db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(or(eq(projects.privacy, "public"), eq(projects.createdBy, userId)))
      .orderBy(projects.name),
    db.select({ id: users.id, name: users.name }).from(users).orderBy(users.name),
    db.select({ id: agents.id, name: agents.name, avatar: agents.avatar, color: agents.color })
      .from(agents)
      .where(eq(agents.isActive, true))
      .orderBy(agents.name),
    db.select({
      id: workflowColumns.id,
      name: workflowColumns.name,
      color: workflowColumns.color,
      sortOrder: workflowColumns.sortOrder,
    }).from(workflowColumns).orderBy(workflowColumns.sortOrder),
    db.select({ id: clients.id, name: clients.name }).from(clients).orderBy(clients.name),
    db.select({ id: objectives.id, title: objectives.title }).from(objectives).orderBy(objectives.createdAt),
  ]);

  if (!project) notFound();
  if (project.privacy === "private" && project.createdBy !== userId) notFound();

  // Cuentas del usuario para el selector de "marcar pagado"
  const [ownedBiz, memberBiz] = await Promise.all([
    db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, userId)),
    db.select({ businessId: businessMembers.businessId }).from(businessMembers).where(eq(businessMembers.userId, userId)),
  ]);
  const bizIds = [...new Set([...ownedBiz.map(b => b.id), ...memberBiz.map(m => m.businessId)])];
  const userAccounts = await db
    .select({ id: accounts.id, name: accounts.name, icon: accounts.icon, currency: accounts.currency, businessId: accounts.businessId })
    .from(accounts)
    .where(
      bizIds.length > 0
        ? or(eq(accounts.userId, userId), inArray(accounts.businessId, bizIds))!
        : eq(accounts.userId, userId)
    )
    .orderBy(accounts.name);

  const projectTasks = rawTasks.map((t) => ({ ...t, projectName: project.name }));

  return (
    <ProjectDetail
      project={project}
      tasks={projectTasks}
      projects={allProjects}
      users={allUsers}
      agents={allAgents}
      clients={allClients}
      objectives={allObjectives}
      customColumns={allCustomColumns}
      accounts={userAccounts}
      currentUserId={userId}
      canEditTasks={canEditTasks}
    />
  );
}
