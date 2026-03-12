/**
 * Centralised access control helper.
 * Checks ownership OR an active share record.
 */
import { db } from "@/db";
import { shares } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getRole } from "@/lib/auth";

type ResourceType = "objective" | "project" | "client" | "task";
type Permission = "view" | "edit";

/**
 * Returns true if userId owns the resource OR has been granted at least minPermission via a share.
 * Admins always pass.
 */
export async function canAccess(
  userId: string,
  resourceType: ResourceType,
  resourceId: string,
  ownerId: string | null | undefined,
  minPermission: Permission = "view"
): Promise<boolean> {
  // Owner always has access
  if (ownerId === userId) return true;

  // Admins see everything
  const role = await getRole();
  if (role === "admin") return true;

  // Check share record
  const [share] = await db
    .select({ permission: shares.permission })
    .from(shares)
    .where(
      and(
        eq(shares.resourceType, resourceType),
        eq(shares.resourceId, resourceId),
        eq(shares.sharedWithId, userId),
      )
    );

  if (!share) return false;
  if (minPermission === "view") return true;
  return share.permission === "edit";
}

/**
 * Returns all share records for a resource (for the owner to manage).
 */
export async function getSharesForResource(resourceType: ResourceType, resourceId: string) {
  return db
    .select()
    .from(shares)
    .where(
      and(
        eq(shares.resourceType, resourceType),
        eq(shares.resourceId, resourceId),
      )
    );
}
