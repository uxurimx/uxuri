import { db } from "@/db";
import { clients } from "@/db/schema";
import { ClientsTable } from "@/components/clients/clients-table";
import { ClientsHeader } from "@/components/clients/clients-header";

export default async function ClientsPage() {
  const allClients = await db.select().from(clients).orderBy(clients.createdAt);

  return (
    <div className="space-y-6">
      <ClientsHeader />
      <ClientsTable clients={allClients} />
    </div>
  );
}
