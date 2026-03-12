/**
 * Helper to verify a user can access an objective (owns it or has a share).
 * Used by all objective sub-routes (milestones, links, attachments, areas).
 */
import { db } from "@/db";
import { objectives } from "@/db/schema";
import { eq } from "drizzle-orm";
import { canAccess } from "@/lib/access";

export async function assertObjectiveAccess(
  userId: string,
  objectiveId: string,
  minPermission: "view" | "edit" = "edit"
): Promise<{ ok: true } | { ok: false; status: 403 | 404 }> {
  const [obj] = await db
    .select({ createdBy: objectives.createdBy })
    .from(objectives)
    .where(eq(objectives.id, objectiveId));

  if (!obj) return { ok: false, status: 404 };

  const allowed = await canAccess(userId, "objective", objectiveId, obj.createdBy, minPermission);
  if (!allowed) return { ok: false, status: 403 };

  return { ok: true };
}
