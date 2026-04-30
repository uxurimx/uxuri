import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { projects, clients, objectives, shares, tasks, businesses, businessMembers } from "@/db/schema";
import { eq, and, inArray, isNotNull, sql, or } from "drizzle-orm";
import { getRole } from "@/lib/auth";
import { getActiveWorkspaceId } from "@/lib/workspace";
import { ProjectsHeader } from "@/components/projects/projects-header";
import { ProjectsList } from "@/components/projects/projects-list";
import { ProjectStats, type UpcomingProject, type OverdueProject } from "@/components/projects/project-stats";

export default async function ProjectsPage(props: {
  searchParams?: Promise<Record<string, string>>;
}) {
  const sp = props.searchParams ? await props.searchParams : {} as Record<string, string>;

  const { userId } = await auth();
  if (!userId) return null;

  const role = await getRole();
  const isAdmin = role === "admin";
  const wsId = await getActiveWorkspaceId();

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
    cycleMinutes: projects.cycleMinutes,
    lastCycleAt: projects.lastCycleAt,
    nextCycleAt: projects.nextCycleAt,
    momentum: projects.momentum,
    workspaceId: projects.workspaceId,
    totalAmount: projects.totalAmount,
    currency: projects.currency,
  } as const;

  // Businesses for project selector
  const memberOf = await db
    .select({ businessId: businessMembers.businessId })
    .from(businessMembers)
    .where(eq(businessMembers.userId, userId));
  const memberIds = memberOf.map((r) => r.businessId);
  const bizWhere = memberIds.length > 0
    ? or(eq(businesses.ownerId, userId), inArray(businesses.id, memberIds))
    : eq(businesses.ownerId, userId);
  const allBusinesses = await db
    .select({ id: businesses.id, name: businesses.name })
    .from(businesses)
    .where(bizWhere!)
    .orderBy(businesses.name);

  const wsFilter = wsId ? eq(projects.workspaceId, wsId) : undefined;
  const wsClientFilter = wsId ? eq(clients.workspaceId, wsId) : undefined;
  const wsObjFilter = wsId ? eq(objectives.workspaceId, wsId) : undefined;

  const ownedWhere = wsFilter
    ? (isAdmin ? wsFilter : and(eq(projects.createdBy, userId), wsFilter))
    : (isAdmin ? undefined : eq(projects.createdBy, userId));

  const [ownedProjects, sharedProjects, allClients, allObjectives, taskCountRows] = await Promise.all([
    db
      .select(projectFields)
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .where(ownedWhere)
      .orderBy(projects.createdAt),
    sharedProjectIds.length > 0
      ? db
          .select(projectFields)
          .from(projects)
          .leftJoin(clients, eq(projects.clientId, clients.id))
          .where(wsFilter
            ? and(inArray(projects.id, sharedProjectIds), wsFilter)
            : inArray(projects.id, sharedProjectIds))
          .orderBy(projects.createdAt)
      : Promise.resolve([]),
    db
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .where(wsClientFilter
        ? (isAdmin ? wsClientFilter : and(eq(clients.createdBy, userId), wsClientFilter))
        : (isAdmin ? undefined : eq(clients.createdBy, userId)))
      .orderBy(clients.name),
    db
      .select({ id: objectives.id, title: objectives.title })
      .from(objectives)
      .where(wsObjFilter
        ? (isAdmin ? wsObjFilter : and(eq(objectives.createdBy, userId), wsObjFilter))
        : (isAdmin ? undefined : eq(objectives.createdBy, userId)))
      .orderBy(objectives.createdAt),
    db
      .select({
        projectId: tasks.projectId,
        total: sql<number>`cast(count(*) as int)`,
        done: sql<number>`cast(count(*) filter (where ${tasks.status} = 'done') as int)`,
      })
      .from(tasks)
      .where(wsId
        ? and(isNotNull(tasks.projectId), eq(tasks.workspaceId, wsId))
        : isNotNull(tasks.projectId))
      .groupBy(tasks.projectId),
  ]);

  // Build task count lookup
  const taskMap: Record<string, { total: number; done: number }> = {};
  for (const row of taskCountRows) {
    if (row.projectId) taskMap[row.projectId] = { total: row.total, done: row.done };
  }

  const allProjects = [
    ...ownedProjects.map((p) => ({
      ...p,
      isShared: false,
      taskCount: taskMap[p.id]?.total ?? 0,
      doneCount: taskMap[p.id]?.done ?? 0,
    })),
    ...sharedProjects.map((p) => ({
      ...p,
      isShared: true,
      sharedPermission: sharedLinks.find((s) => s.resourceId === p.id)?.permission ?? "view",
      taskCount: taskMap[p.id]?.total ?? 0,
      doneCount: taskMap[p.id]?.done ?? 0,
    })),
  ] as Parameters<typeof ProjectsList>[0]["projects"];

  // Compute dashboard stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in14 = new Date(today);
  in14.setDate(in14.getDate() + 14);

  const total = allProjects.length;
  const active = allProjects.filter((p) => p.status === "active").length;
  const planning = allProjects.filter((p) => p.status === "planning").length;
  const completed = allProjects.filter((p) => p.status === "completed").length;

  const overdueList = allProjects.filter(
    (p) =>
      p.endDate &&
      new Date(p.endDate) < today &&
      p.status !== "completed" &&
      p.status !== "cancelled"
  );
  const overdue = overdueList.length;

  const overdueProjects: OverdueProject[] = overdueList
    .sort((a, b) => new Date(a.endDate!).getTime() - new Date(b.endDate!).getTime())
    .map((p) => ({ id: p.id, name: p.name, endDate: p.endDate!, priority: p.priority }));

  const noDateCount = allProjects.filter(
    (p) => !p.endDate && p.status !== "completed" && p.status !== "cancelled"
  ).length;

  const totalActiveBudget = allProjects
    .filter((p) => p.status === "active")
    .reduce((sum, p) => sum + Number((p as { totalAmount?: string | null }).totalAmount ?? 0), 0);

  const primaryCurrency = allProjects.find(
    (p) => p.status === "active" && (p as { currency?: string | null }).currency
  ) as { currency?: string | null } | undefined;
  const currency = (primaryCurrency?.currency) ?? "MXN";

  const upcoming: UpcomingProject[] = allProjects
    .filter(
      (p) =>
        p.endDate &&
        new Date(p.endDate) >= today &&
        new Date(p.endDate) <= in14 &&
        p.status !== "completed" &&
        p.status !== "cancelled"
    )
    .sort((a, b) => new Date(a.endDate!).getTime() - new Date(b.endDate!).getTime())
    .slice(0, 6)
    .map((p) => ({
      id: p.id,
      name: p.name,
      endDate: p.endDate!,
      status: p.status,
      priority: p.priority,
      taskCount: p.taskCount,
      doneCount: p.doneCount,
    }));

  const activeFilter = sp.status ?? "active";

  return (
    <div className="space-y-6">
      <ProjectsHeader />
      <ProjectStats
        total={total}
        active={active}
        planning={planning}
        completed={completed}
        overdue={overdue}
        upcoming={upcoming}
        overdueProjects={overdueProjects}
        totalActiveBudget={totalActiveBudget}
        noDateCount={noDateCount}
        currency={currency}
        activeFilter={activeFilter}
      />
      <ProjectsList
        projects={allProjects}
        clients={allClients}
        objectives={allObjectives}
        businesses={allBusinesses}
        currentUserId={userId}
        initialFilters={{
          status: sp.status,
          priority: sp.priority,
          range: sp.range,
          privacy: sp.privacy,
          owner: sp.owner,
          clientId: sp.client,
          category: sp.category,
          search: sp.q,
          sort: sp.sort,
        }}
      />
    </div>
  );
}
