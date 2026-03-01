import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { clients, projects } from "@/db/schema";
import { eq } from "drizzle-orm";
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

  const clientProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.clientId, id));

  return <ClientDetail client={client} projects={clientProjects} currentUserId={userId ?? undefined} />;
}
