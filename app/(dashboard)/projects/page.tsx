import { db } from "@/db";
import { projects, clients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ProjectsHeader } from "@/components/projects/projects-header";
import { ProjectsList } from "@/components/projects/projects-list";

export default async function ProjectsPage() {
  const allProjects = await db
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
    .orderBy(projects.createdAt);

  return (
    <div className="space-y-6">
      <ProjectsHeader />
      <ProjectsList projects={allProjects} />
    </div>
  );
}
