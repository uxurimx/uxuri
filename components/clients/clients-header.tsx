import Link from "next/link";
import { Plus } from "lucide-react";

export function ClientsHeader() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Clientes</h1>
        <p className="text-slate-500 text-sm mt-1">
          Gestiona tu base de clientes
        </p>
      </div>
      <Link
        href="/clients/new"
        className="inline-flex items-center gap-2 bg-[#1e3a5f] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#162d4a] transition-colors"
      >
        <Plus className="w-4 h-4" />
        Nuevo cliente
      </Link>
    </div>
  );
}
