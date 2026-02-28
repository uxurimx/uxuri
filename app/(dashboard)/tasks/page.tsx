import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { tasks, projects, users } from "@/db/schema";
import { eq, or, isNull } from "drizzle-orm";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { TasksHeader } from "@/components/tasks/tasks-header";

export default async function TasksPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const [allTasks, allProjects, allUsers] = await Promise.all([
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        projectId: tasks.projectId,
        clientId: tasks.clientId,
        assignedTo: tasks.assignedTo,
        status: tasks.status,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
        sortOrder: tasks.sortOrder,
        createdAt: tasks.createdAt,
        createdBy: tasks.createdBy,
        projectName: projects.name,
      })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(or(
        isNull(tasks.projectId),
        eq(projects.privacy, "public"),
        eq(projects.createdBy, userId),
      ))
      .orderBy(tasks.createdAt),
    db.select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(or(eq(projects.privacy, "public"), eq(projects.createdBy, userId)))
      .orderBy(projects.name),
    db.select({ id: users.id, name: users.name }).from(users).orderBy(users.name),
  ]);

  return (
    <div className="space-y-6">
      <TasksHeader projects={allProjects} users={allUsers} currentUserId={userId} />
      <KanbanBoard initialTasks={allTasks} projects={allProjects} users={allUsers} currentUserId={userId} />
    </div>
  );
}
