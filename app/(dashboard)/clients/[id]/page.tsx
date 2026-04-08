import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { clients, projects, accounts, businesses, businessMembers } from "@/db/schema";
import { eq, or, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ClientDetail } from "@/components/clients/client-detail";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  const { id } = await params;

  const [client] = await db.select().from(clients).where(eq(clients.id, id));
  if (!client) notFound();

  // Fetch user's accounts for "Registrar pago" button
  const userAccounts = userId
    ? await (async () => {
        const [owned, member] = await Promise.all([
          db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, userId)),
          db.select({ businessId: businessMembers.businessId }).from(businessMembers).where(eq(businessMembers.userId, userId)),
        ]);
        const bizIds = [...new Set([...owned.map((b) => b.id), ...member.map((m) => m.businessId)])];
        return db
          .select({ id: accounts.id, name: accounts.name, icon: accounts.icon, currency: accounts.currency, businessId: accounts.businessId })
          .from(accounts)
          .where(
            bizIds.length > 0
              ? or(eq(accounts.userId, userId), inArray(accounts.businessId, bizIds))!
              : eq(accounts.userId, userId)
          )
          .orderBy(accounts.name);
      })()
    : [];

  const clientProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.clientId, id));

  return (
    <ClientDetail
      client={client}
      projects={clientProjects}
      currentUserId={userId ?? undefined}
      accounts={userAccounts}
    />
  );
}
