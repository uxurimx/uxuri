import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { projects, clients, tasks } from "@/db/schema";
import { eq, or } from "drizzle-orm";
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

  const [[project], rawTasks, allProjects] = await Promise.all([
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
    db.select().from(tasks).where(eq(tasks.projectId, id)),
    db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(or(eq(projects.privacy, "public"), eq(projects.createdBy, userId)))
      .orderBy(projects.name),
  ]);

  if (!project) notFound();

  // Bloquear acceso a proyectos privados de otros usuarios
  if (project.privacy === "private" && project.createdBy !== userId) notFound();

  const projectTasks = rawTasks.map((t) => ({ ...t, projectName: project.name }));

  return (
    <ProjectDetail
      project={project}
      tasks={projectTasks}
      projects={allProjects}
      currentUserId={userId}
    />
  );
}
