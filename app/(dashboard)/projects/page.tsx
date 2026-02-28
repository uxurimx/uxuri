import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { projects, clients } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { ProjectsHeader } from "@/components/projects/projects-header";
import { ProjectsList } from "@/components/projects/projects-list";

export default async function ProjectsPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const [allProjects, allClients] = await Promise.all([
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
      .where(or(eq(projects.privacy, "public"), eq(projects.createdBy, userId)))
      .orderBy(projects.createdAt),
    db.select({ id: clients.id, name: clients.name }).from(clients).orderBy(clients.name),
  ]);

  return (
    <div className="space-y-6">
      <ProjectsHeader />
      <ProjectsList projects={allProjects} clients={allClients} currentUserId={userId} />
    </div>
  );
}
