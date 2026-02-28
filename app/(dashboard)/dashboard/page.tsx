import { db } from "@/db";
import { clients, projects, tasks, users } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { StatsCard } from "@/components/dashboard/stats-card";
import { Users, Briefcase, CheckSquare, UserCheck } from "lucide-react";

export default async function DashboardPage() {
  const [
    [clientCount],
    [projectCount],
    [taskCount],
    [userCount],
    activeProjects,
    recentTasks,
  ] = await Promise.all([
    db.select({ count: count() }).from(clients),
    db.select({ count: count() }).from(projects),
    db.select({ count: count() }).from(tasks),
    db.select({ count: count() }).from(users),
    db.select().from(projects).where(eq(projects.status, "active")).limit(5),
    db.select().from(tasks).where(eq(tasks.status, "in_progress")).limit(5),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">
          Resumen general de tu negocio
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Clientes"
          value={clientCount.count}
          icon={Users}
          color="blue"
        />
        <StatsCard
          title="Proyectos"
          value={projectCount.count}
          icon={Briefcase}
          color="indigo"
        />
        <StatsCard
          title="Tareas"
          value={taskCount.count}
          icon={CheckSquare}
          color="emerald"
        />
        <StatsCard
          title="Usuarios"
          value={userCount.count}
          icon={UserCheck}
          color="purple"
        />
      </div>

      {/* Active Projects & Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Projects */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 mb-4">
            Proyectos Activos
          </h2>
          {activeProjects.length === 0 ? (
            <p className="text-slate-400 text-sm">No hay proyectos activos</p>
          ) : (
            <div className="space-y-3">
              {activeProjects.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                >
                  <span className="text-sm font-medium text-slate-700">
                    {p.name}
                  </span>
                  <span className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full">
                    {p.priority}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tasks in progress */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 mb-4">
            Tareas en Progreso
          </h2>
          {recentTasks.length === 0 ? (
            <p className="text-slate-400 text-sm">No hay tareas en progreso</p>
          ) : (
            <div className="space-y-3">
              {recentTasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                >
                  <span className="text-sm font-medium text-slate-700">
                    {t.title}
                  </span>
                  <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full">
                    {t.priority}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
