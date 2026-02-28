import { db } from "@/db";
import { tasks, projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { TasksHeader } from "@/components/tasks/tasks-header";

export default async function TasksPage() {
  const allTasks = await db
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
      createdAt: tasks.createdAt,
      projectName: projects.name,
    })
    .from(tasks)
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .orderBy(tasks.createdAt);

  return (
    <div className="space-y-6">
      <TasksHeader />
      <KanbanBoard initialTasks={allTasks} />
    </div>
  );
}
