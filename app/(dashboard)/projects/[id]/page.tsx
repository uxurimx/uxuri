import { db } from "@/db";
import { projects, clients, tasks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ProjectDetail } from "@/components/projects/project-detail";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [project] = await db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      clientId: projects.clientId,
      status: projects.status,
      priority: projects.priority,
      startDate: projects.startDate,
      endDate: projects.endDate,
      createdAt: projects.createdAt,
      clientName: clients.name,
    })
    .from(projects)
    .leftJoin(clients, eq(projects.clientId, clients.id))
    .where(eq(projects.id, id));

  if (!project) notFound();

  // Incluir projectName para que sea compatible con TaskWithProject en KanbanBoard
  const rawTasks = await db.select().from(tasks).where(eq(tasks.projectId, id));
  const projectTasks = rawTasks.map((t) => ({ ...t, projectName: project.name }));

  return <ProjectDetail project={project} tasks={projectTasks} />;
}
