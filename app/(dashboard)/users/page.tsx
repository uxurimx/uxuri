import { db } from "@/db";
import { users } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { UsersTable } from "@/components/users/users-table";

export default async function UsersPage() {
  await requireRole("admin");

  const allUsers = await db.select().from(users).orderBy(users.createdAt);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Usuarios</h1>
        <p className="text-slate-500 text-sm mt-1">
          Gestiona los usuarios y sus roles en el sistema
        </p>
      </div>
      <UsersTable users={allUsers} />
    </div>
  );
}
