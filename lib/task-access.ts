import { db } from "@/db";
import { tasks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getRole } from "@/lib/auth";

/**
 * Verify a user can access a task (owns it, is assigned, or is admin).
 * minPermission="edit" restricts to creator + admin only.
 */
export async function assertTaskAccess(
  userId: string,
  taskId: string,
  minPermission: "view" | "edit" = "view"
): Promise<{ ok: true } | { ok: false; status: 403 | 404 }> {
  const [task] = await db
    .select({ createdBy: tasks.createdBy, assignedTo: tasks.assignedTo })
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

  // view: creator or assigned or admin
  if (!isCreator && !isAssigned) {
    const role = await getRole();
    if (role !== "admin") return { ok: false, status: 403 };
  }

  return { ok: true };
}
