import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getRole } from "@/lib/auth";
import { ProjectForm } from "@/components/projects/project-form";

export default async function NewProjectPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const role = await getRole();
  const isAdmin = role === "admin";

  const allClients = isAdmin
    ? await db.select().from(clients)
    : await db.select().from(clients).where(eq(clients.createdBy, userId));

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Nuevo Proyecto</h1>
        <p className="text-slate-500 text-sm mt-1">
          Crea un nuevo proyecto y asígnalo a un cliente
        </p>
      </div>
      <ProjectForm clients={allClients} />
    </div>
  );
}
