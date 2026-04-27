import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { clients, shares } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getRole } from "@/lib/auth";
import { getActiveWorkspaceId } from "@/lib/workspace";
import { ClientsTable } from "@/components/clients/clients-table";
import { ClientsHeader } from "@/components/clients/clients-header";

export default async function ClientsPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const role = await getRole();
  const isAdmin = role === "admin";
  const wsId = await getActiveWorkspaceId();
  const wsFilter = wsId ? eq(clients.workspaceId, wsId) : undefined;

  // Shared client IDs for this user
  const sharedLinks = await db
    .select({ resourceId: shares.resourceId })
    .from(shares)
    .where(and(eq(shares.resourceType, "client"), eq(shares.sharedWithId, userId)));
  const sharedClientIds = sharedLinks.map((s) => s.resourceId);

  const ownedWhere = wsFilter
    ? (isAdmin ? wsFilter : and(eq(clients.createdBy, userId), wsFilter))
    : (isAdmin ? undefined : eq(clients.createdBy, userId));

  const [ownedClients, sharedClients] = await Promise.all([
    db.select().from(clients).where(ownedWhere).orderBy(clients.createdAt),
    sharedClientIds.length > 0
      ? db.select().from(clients).where(
          wsFilter
            ? and(inArray(clients.id, sharedClientIds), wsFilter)
            : inArray(clients.id, sharedClientIds)
        ).orderBy(clients.createdAt)
      : Promise.resolve([]),
  ]);

  const allClients = [
    ...ownedClients.map((c) => ({ ...c, isShared: false })),
    ...sharedClients.map((c) => ({ ...c, isShared: true })),
  ];

  return (
    <div className="space-y-6">
      <ClientsHeader />
      <ClientsTable clients={allClients} />
    </div>
  );
}
