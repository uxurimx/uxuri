import { ClientForm } from "@/components/clients/client-form";

export default function NewClientPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Nuevo Cliente</h1>
        <p className="text-slate-500 text-sm mt-1">
          Agrega un nuevo cliente a tu base de datos
        </p>
      </div>
      <ClientForm />
    </div>
  );
}
