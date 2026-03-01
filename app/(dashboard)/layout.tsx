import { auth } from "@clerk/nextjs/server";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { MobileTopActions } from "@/components/dashboard/mobile-top-actions";
import { getUserRoleData } from "@/lib/auth";
import { ToastProvider } from "@/components/ui/toast";
import { NotificationListener } from "@/components/notifications/notification-listener";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  const roleData = await getUserRoleData();
  const rawPermissions = roleData?.permissions ?? [];
  // Compatibilidad con roles existentes: /agents se agrega automáticamente
  // a cualquier rol que ya tenga /tasks (admin y manager)
  const permissions =
    rawPermissions.includes("/tasks") && !rawPermissions.includes("/agents")
      ? [...rawPermissions, "/agents"]
      : rawPermissions;

  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden bg-[var(--skin-page-bg)]">
        <Sidebar permissions={permissions} currentUserId={userId ?? ""} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-y-auto p-4 pt-12 pb-20 md:pt-4 md:pb-6 md:p-6 lg:p-8">
            {children}
          </main>
        </div>
        <MobileNav permissions={permissions} currentUserId={userId ?? ""} />
        <MobileTopActions />
      </div>
      {userId && <NotificationListener userId={userId} />}
    </ToastProvider>
  );
}
