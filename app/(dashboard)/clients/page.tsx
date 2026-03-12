import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { clients, shares } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getRole } from "@/lib/auth";
import { ClientsTable } from "@/components/clients/clients-table";
import { ClientsHeader } from "@/components/clients/clients-header";

export default async function ClientsPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const role = await getRole();
  const isAdmin = role === "admin";

  // Shared client IDs for this user
  const sharedLinks = await db
    .select({ resourceId: shares.resourceId })
    .from(shares)
    .where(and(eq(shares.resourceType, "client"), eq(shares.sharedWithId, userId)));
  const sharedClientIds = sharedLinks.map((s) => s.resourceId);

  const [ownedClients, sharedClients] = await Promise.all([
    isAdmin
      ? db.select().from(clients).orderBy(clients.createdAt)
      : db.select().from(clients).where(eq(clients.createdBy, userId)).orderBy(clients.createdAt),
    sharedClientIds.length > 0
      ? db.select().from(clients).where(inArray(clients.id, sharedClientIds)).orderBy(clients.createdAt)
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
