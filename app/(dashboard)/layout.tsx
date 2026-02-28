import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { getUserRoleData } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const roleData = await getUserRoleData();
  const permissions = roleData?.permissions ?? [];

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar permissions={permissions} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
      <MobileNav permissions={permissions} />
    </div>
  );
}
