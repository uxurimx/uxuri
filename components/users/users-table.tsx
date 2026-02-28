"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@/db/schema/users";
import type { RoleRecord } from "@/db/schema/roles";
import { RoleBadge } from "./role-badge";
import { formatDate } from "@/lib/utils";

export function UsersTable({ users, roles }: { users: User[]; roles: RoleRecord[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

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

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Usuario</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Rol</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Registro</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Cambiar rol</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    {user.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.imageUrl} alt={user.name ?? ""} className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                        <span className="text-xs font-semibold text-slate-600">
                          {(user.name ?? user.email)[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                    <span className="text-sm font-medium text-slate-900">{user.name ?? "—"}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">{user.email}</td>
                <td className="px-6 py-4">
                  <RoleBadge role={user.role} />
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">{formatDate(user.createdAt)}</td>
                <td className="px-6 py-4">
                  <select
                    value={user.role}
                    disabled={loading === user.id}
                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    className="text-sm border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 disabled:opacity-50"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {users.length === 0 && (
          <div className="text-center py-12 text-slate-400">No hay usuarios registrados</div>
        )}
      </div>
    </div>
  );
}
