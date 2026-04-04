import { auth } from "@clerk/nextjs/server";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { MobileTopActions } from "@/components/dashboard/mobile-top-actions";
import { getUserRoleData, augmentPermissions } from "@/lib/auth";
import { ToastProvider } from "@/components/ui/toast";
import { NotificationListener } from "@/components/notifications/notification-listener";
import { PwaRegister } from "@/components/pwa-register";
import { GlobalQuickAddProvider } from "@/components/global/global-quick-add-provider";
import { ScrollReset } from "@/components/scroll-reset";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  const roleData = await getUserRoleData();
  // augmentPermissions ya fue aplicado dentro de getUserRoleData
  const permissions = roleData?.permissions ?? [];

  return (
    <ToastProvider>
      <GlobalQuickAddProvider>
        <div className="flex h-screen overflow-hidden bg-[var(--skin-page-bg)]">
          <Sidebar permissions={permissions} currentUserId={userId ?? ""} />
          <div className="flex flex-col flex-1 overflow-hidden">
            <Topbar />
            <main className="flex-1 overflow-y-auto p-4 pt-12 pb-20 md:pt-4 md:pb-6 md:p-6 lg:p-8">
              <ScrollReset />
              {children}
            </main>
          </div>
          <MobileNav permissions={permissions} currentUserId={userId ?? ""} />
          <MobileTopActions />
        </div>
        {userId && <NotificationListener userId={userId} />}
        <PwaRegister />
      </GlobalQuickAddProvider>
    </ToastProvider>
  );
}
