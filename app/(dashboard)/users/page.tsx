import { db } from "@/db";
import { users, roles } from "@/db/schema";
import { requireAccess } from "@/lib/auth";
import { UsersTable } from "@/components/users/users-table";
import { RolesTab } from "@/components/users/roles-tab";

interface Props {
  searchParams: Promise<{ tab?: string }>;
}

export default async function UsersPage({ searchParams }: Props) {
  await requireAccess("/users");

  const { tab } = await searchParams;
  const activeTab = tab === "roles" ? "roles" : "users";

  const [allUsers, allRoles] = await Promise.all([
    db.select().from(users).orderBy(users.createdAt),
    db.select().from(roles).orderBy(roles.createdAt),
  ]);


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Usuarios</h1>
        <p className="text-slate-500 text-sm mt-1">
          Gestiona usuarios y roles del sistema
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        <a
          href="/users"
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "users"
              ? "border-[#1e3a5f] text-[#1e3a5f]"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Usuarios
        </a>
        <a
          href="/users?tab=roles"
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "roles"
              ? "border-[#1e3a5f] text-[#1e3a5f]"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Roles
        </a>
      </div>

      {activeTab === "users" && <UsersTable users={allUsers} roles={allRoles} />}
      {activeTab === "roles" && <RolesTab initialRoles={allRoles} />}
    </div>
  );
}
