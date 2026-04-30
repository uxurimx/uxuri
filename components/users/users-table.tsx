"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@/db/schema/users";
import type { RoleRecord } from "@/db/schema/roles";
import { RoleBadge } from "./role-badge";
import { formatDate } from "@/lib/utils";
import { Search, AlertTriangle } from "lucide-react";

export function UsersTable({ users, roles }: { users: User[]; roles: RoleRecord[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  async function handleRoleChange(userId: string, role: string) {
    setLoading(userId);
    try {
      await fetch(`/api/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      !q ||
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q)
    );
  });

  const noRoles = roles.length === 0;

  return (
    <div className="space-y-3">
      {noRoles && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            No hay roles creados. Ve a la pestaña <strong>Roles</strong> y usa &quot;Roles por defecto&quot; para configurar los permisos.
          </p>
        </div>
      )}

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, email o rol..."
          className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Usuario</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Email</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Rol actual</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Registro</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Cambiar rol</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((user) => {
                const roleExists = noRoles || roles.some((r) => r.name === user.role);
                return (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {user.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={user.imageUrl} alt={user.name ?? ""} className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-semibold text-slate-600">
                              {(user.name ?? user.email ?? "?")[0].toUpperCase()}
                            </span>
                          </div>
                        )}
                        <span className="text-sm font-medium text-slate-900">{user.name ?? "—"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 hidden sm:table-cell">{user.email}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <RoleBadge role={user.role} />
                        {!roleExists && (
                          <span className="text-xs text-amber-600" title="Este rol no tiene permisos configurados">
                            ⚠️
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 hidden md:table-cell">{formatDate(user.createdAt)}</td>
                    <td className="px-6 py-4">
                      {noRoles ? (
                        <span className="text-xs text-slate-400">Sin roles</span>
                      ) : (
                        <select
                          value={user.role}
                          disabled={loading === user.id}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 disabled:opacity-50 cursor-pointer"
                        >
                          {roles.map((r) => (
                            <option key={r.id} value={r.name}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-sm">
              {search ? `Sin resultados para "${search}"` : "No hay usuarios registrados"}
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-400 text-right">
        {filtered.length} de {users.length} usuario{users.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
