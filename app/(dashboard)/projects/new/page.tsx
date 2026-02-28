import { db } from "@/db";
import { clients } from "@/db/schema";
import { ProjectForm } from "@/components/projects/project-form";

export default async function NewProjectPage() {
  const allClients = await db.select().from(clients);

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
