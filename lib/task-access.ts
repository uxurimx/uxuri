import { db } from "@/db";
import { tasks, shares } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getRole } from "@/lib/auth";

/**
 * Verify a user can access a task:
 *   - owns it
 *   - is assigned
 *   - is admin
 *   - is a collaborator on the task's project (any share permission level = view access)
 *
 * minPermission="edit" restricts to creator + admin only (no project-share bypass).
 */
export async function assertTaskAccess(
  userId: string,
  taskId: string,
  minPermission: "view" | "edit" = "view"
): Promise<{ ok: true } | { ok: false; status: 403 | 404 }> {
  const [task] = await db
    .select({ createdBy: tasks.createdBy, assignedTo: tasks.assignedTo, projectId: tasks.projectId })
    .from(tasks)
    .where(eq(tasks.id, taskId));

  if (!task) return { ok: false, status: 404 };

  const isCreator = !task.createdBy || task.createdBy === userId;
  const isAssigned = task.assignedTo === userId;

  if (minPermission === "edit") {
    if (!isCreator) {
      const role = await getRole();
      if (role !== "admin") return { ok: false, status: 403 };
    }
    return { ok: true };
  }

  // view: creator or assigned or admin or project collaborator (any share level)
  if (!isCreator && !isAssigned) {
    const role = await getRole();
    if (role === "admin") return { ok: true };

    // Check if user has any share on the project this task belongs to
    if (task.projectId) {
      const [share] = await db
        .select({ id: shares.id })
        .from(shares)
        .where(
          and(
            eq(shares.resourceType, "project"),
            eq(shares.resourceId, task.projectId),
            eq(shares.sharedWithId, userId),
          )
        )
        .limit(1);
      if (share) return { ok: true };
    }

    return { ok: false, status: 403 };
  }

  return { ok: true };
}
