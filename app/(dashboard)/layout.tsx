import { auth } from "@clerk/nextjs/server";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { MobileNav } from "@/components/dashboard/mobile-nav";
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
  const permissions = roleData?.permissions ?? [];

  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden bg-slate-50">
        <Sidebar permissions={permissions} currentUserId={userId ?? ""} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-y-auto p-4 pb-20 md:pb-6 md:p-6 lg:p-8">
            {children}
          </main>
        </div>
        <MobileNav permissions={permissions} currentUserId={userId ?? ""} />
      </div>
      {userId && <NotificationListener userId={userId} />}
    </ToastProvider>
  );
}
