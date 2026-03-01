import { UserButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { PushSetup } from "@/components/notifications/push-setup";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export async function Topbar() {
  const user = await currentUser();

  return (
    <header className="hidden md:flex h-16 bg-[var(--skin-header-bg)] border-b border-[var(--skin-border)] items-center justify-between px-4 md:px-6 flex-shrink-0">
      <div className="flex items-center gap-4">
        <p className="text-sm text-[var(--skin-header-text-muted)] hidden sm:block">
          Bienvenido,{" "}
          <span className="font-semibold text-[var(--skin-header-text-strong)]">
            {user?.firstName ?? "Usuario"}
          </span>
        </p>
      </div>

      <div className="flex items-center gap-3">
        <PushSetup />
        <NotificationBell />
        <ThemeToggle />
        <UserButton afterSignOutUrl="/" />
      </div>
    </header>
  );
}
