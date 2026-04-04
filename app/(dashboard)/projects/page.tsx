import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { projects, clients, objectives, shares } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getRole } from "@/lib/auth";
import { ProjectsHeader } from "@/components/projects/projects-header";
import { ProjectsList } from "@/components/projects/projects-list";

export default async function ProjectsPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const role = await getRole();
  const isAdmin = role === "admin";

  // Shared project IDs for this user
  const sharedLinks = await db
    .select({ resourceId: shares.resourceId, permission: shares.permission })
    .from(shares)
    .where(and(eq(shares.resourceType, "project"), eq(shares.sharedWithId, userId)));
  const sharedProjectIds = sharedLinks.map((s) => s.resourceId);

  const projectFields = {
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
  } as const;

  const [ownedProjects, sharedProjects, allClients, allObjectives] = await Promise.all([
    db
      .select(projectFields)
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .where(isAdmin ? undefined : eq(projects.createdBy, userId))
      .orderBy(projects.createdAt),
    sharedProjectIds.length > 0
      ? db
          .select(projectFields)
          .from(projects)
          .leftJoin(clients, eq(projects.clientId, clients.id))
          .where(inArray(projects.id, sharedProjectIds))
          .orderBy(projects.createdAt)
      : Promise.resolve([]),
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

  const allProjects = [
    ...ownedProjects.map((p) => ({ ...p, isShared: false })),
    ...sharedProjects.map((p) => ({
      ...p,
      isShared: true,
      sharedPermission: sharedLinks.find((s) => s.resourceId === p.id)?.permission ?? "view",
    })),
  ];

  return (
    <div className="space-y-6">
      <ProjectsHeader />
      <ProjectsList
        projects={allProjects}
        clients={allClients}
        objectives={allObjectives}
        currentUserId={userId}
      />
    </div>
  );
}
