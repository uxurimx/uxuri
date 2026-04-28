"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, Fragment } from "react";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, NavItem } from "@/lib/nav-groups";
import { NavPrefs, DEFAULT_PREFS, loadNavPrefs, applyOrder } from "@/lib/nav-prefs";
import { useChatUnread } from "@/hooks/use-chat-unread";
import { useToast, type Notification } from "@/components/ui/toast";
import {
  Bell, Settings, X, CheckCheck, Trash2,
  Info, CheckCircle, AlertCircle, ExternalLink,
} from "lucide-react";
import { UserButton } from "@clerk/nextjs";

// ─── helpers ────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  info:    <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />,
  success: <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />,
  warning: <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />,
};

// ─── Notification bottom sheet ───────────────────────────────────────────────

function NotificationSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { notifications, unreadCount, markAllRead, clearNotifications } = useToast();

  useEffect(() => {
    if (open && unreadCount > 0) {
      const t = setTimeout(markAllRead, 400);
      return () => clearTimeout(t);
    }
  }, [open, unreadCount, markAllRead]);

  function handleItem(n: Notification) {
    onClose();
    if (n.url) router.push(n.url);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative bg-[var(--skin-card-bg,#fff)] rounded-t-2xl z-50 max-h-[75vh] flex flex-col shadow-2xl">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-[var(--skin-border,#e2e8f0)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--skin-border,#e2e8f0)] flex-shrink-0">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[var(--skin-active-text,#1e3a5f)]" />
            <span className="text-sm font-semibold text-[var(--skin-card-text,#0f172a)]">
              Notificaciones
            </span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {notifications.length > 0 && (
              <>
                <button
                  onClick={markAllRead}
                  className="p-2 rounded-lg text-[var(--skin-text-muted,#64748b)] hover:bg-[var(--skin-content-bg,#f1f5f9)] transition-colors"
                  title="Marcar todo leído"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
                <button
                  onClick={clearNotifications}
                  className="p-2 rounded-lg text-[var(--skin-text-muted,#64748b)] hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Limpiar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-[var(--skin-text-muted,#64748b)] hover:bg-[var(--skin-content-bg,#f1f5f9)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1">
          {notifications.length === 0 ? (
            <div className="py-16 text-center">
              <Bell className="w-10 h-10 text-[var(--skin-border,#e2e8f0)] mx-auto mb-3" />
              <p className="text-sm text-[var(--skin-text-muted,#94a3b8)]">Sin notificaciones</p>
            </div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleItem(n)}
                className={cn(
                  "w-full flex items-start gap-3 px-5 py-4 border-b border-[var(--skin-divider,#f1f5f9)] last:border-0 text-left transition-colors",
                  n.url ? "hover:bg-[var(--skin-content-bg,#f8fafc)] cursor-pointer" : "cursor-default",
                  !n.read && "bg-blue-50/30"
                )}
              >
                <div className="mt-0.5">{TYPE_ICON[n.type]}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--skin-card-text,#334155)] leading-snug">{n.message}</p>
                  <p className="text-xs text-[var(--skin-text-muted,#94a3b8)] mt-1">{timeAgo(n.timestamp)}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                  {n.url && <ExternalLink className="w-3.5 h-3.5 text-[var(--skin-border,#cbd5e1)]" />}
                  {!n.read && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Safe area for iOS home bar */}
        <div className="h-6 flex-shrink-0" />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MobileNav({
  permissions,
  currentUserId,
}: {
  permissions: string[];
  currentUserId: string;
}) {
  const pathname = usePathname();
  const hasUnread = useChatUnread(currentUserId);
  const { unreadCount } = useToast();
  const [prefs, setPrefs]         = useState<NavPrefs>(DEFAULT_PREFS);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => { setPrefs(loadNavPrefs()); }, []);
  useEffect(() => {
    function onPrefsChanged() { setPrefs(loadNavPrefs()); }
    window.addEventListener("nav-prefs-changed", onPrefsChanged);
    return () => window.removeEventListener("nav-prefs-changed", onPrefsChanged);
  }, []);

  function getOrderedItems(groupId: string, items: NavItem[]): NavItem[] {
    const custom = prefs.groupItemOrder[groupId] ?? [];
    const hrefs  = applyOrder(items.map((i) => i.href), custom);
    const map    = new Map(items.map((i) => [i.href, i]));
    return hrefs.map((h) => map.get(h)!).filter(Boolean);
  }

  const isSettingsActive = pathname.startsWith("/settings");

  return (
    <>
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-[var(--skin-header-bg)] border-t border-[var(--skin-border)] z-40">
        <div className="flex items-center py-2 overflow-x-auto scrollbar-none px-2 gap-0.5">

          {/* ── Regular nav items from groups ── */}
          {NAV_GROUPS.map((group, gi) => {
            const source = group.collapsable
              ? getOrderedItems(group.id, group.items)
              : group.items;
            const visibleItems = source.filter(
              (item) =>
                permissions.includes(item.href) &&
                !prefs.hiddenMobile.includes(item.href)
            );
            if (visibleItems.length === 0) return null;

            return (
              <Fragment key={group.id}>
                {gi > 0 && (
                  <div className="w-px h-8 bg-[var(--skin-border)] shrink-0 mx-1 opacity-40" />
                )}
                {visibleItems.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  const showDot  = item.href === "/chat" && hasUnread && !isActive;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors shrink-0",
                        isActive
                          ? "text-[var(--skin-active-text)]"
                          : "text-[var(--skin-sidebar-text)]"
                      )}
                    >
                      <div className="relative">
                        <item.icon className="w-5 h-5" />
                        {showDot && (
                          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[var(--skin-header-bg)]" />
                        )}
                      </div>
                      <span className="text-[10px] font-medium">
                        {item.mobileLabel ?? item.label}
                      </span>
                    </Link>
                  );
                })}
              </Fragment>
            );
          })}

          {/* ── Separator ── */}
          <div className="w-px h-8 bg-[var(--skin-border)] shrink-0 mx-1 opacity-40" />

          {/* ── Notifications ── */}
          <button
            onClick={() => setNotifOpen(true)}
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors shrink-0 text-[var(--skin-sidebar-text)]"
          >
            <div className="relative">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">Alertas</span>
          </button>

          {/* ── Configuración ── */}
          <Link
            href="/settings"
            className={cn(
              "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors shrink-0",
              isSettingsActive
                ? "text-[var(--skin-active-text)]"
                : "text-[var(--skin-sidebar-text)]"
            )}
          >
            <Settings className="w-5 h-5" />
            <span className="text-[10px] font-medium">Config.</span>
          </Link>

          {/* ── Perfil (Clerk UserButton) ── */}
          <div className="flex flex-col items-center gap-1 px-3 py-2 shrink-0">
            <div className="w-5 h-5 flex items-center justify-center">
              <UserButton afterSignOutUrl="/" />
            </div>
            <span className="text-[10px] font-medium text-[var(--skin-sidebar-text)]">Perfil</span>
          </div>

        </div>
      </nav>

      {/* ── Notification sheet (portal-like, rendered outside nav) ── */}
      <NotificationSheet open={notifOpen} onClose={() => setNotifOpen(false)} />
    </>
  );
}
