import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { projects, clients, tasks, users, agents, userTaskPreferences } from "@/db/schema";
import { eq, or, and, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ProjectDetail } from "@/components/projects/project-detail";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) return null;

  const { id } = await params;

  const [[project], rawTasks, allProjects, allUsers, allAgents] = await Promise.all([
    db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        clientId: projects.clientId,
        status: projects.status,
        priority: projects.priority,
        privacy: projects.privacy,
        startDate: projects.startDate,
        endDate: projects.endDate,
        createdAt: projects.createdAt,
        createdBy: projects.createdBy,
        clientName: clients.name,
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
        status: tasks.status,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
        sortOrder: sql<number | null>`COALESCE(${userTaskPreferences.sortOrder}, ${tasks.sortOrder})`,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        createdBy: tasks.createdBy,
        personalDone: sql<boolean>`COALESCE(${userTaskPreferences.personalDone}, false)`,
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
  ]);

  if (!project) notFound();
  if (project.privacy === "private" && project.createdBy !== userId) notFound();

  const projectTasks = rawTasks.map((t) => ({ ...t, projectName: project.name }));

  return (
    <ProjectDetail
      project={project}
      tasks={projectTasks}
      projects={allProjects}
      users={allUsers}
      agents={allAgents}
      currentUserId={userId}
    />
  );
}
