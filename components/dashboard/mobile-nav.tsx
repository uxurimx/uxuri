"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, Fragment } from "react";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, NavItem } from "@/lib/nav-groups";
import { NavPrefs, DEFAULT_PREFS, loadNavPrefs, applyOrder } from "@/lib/nav-prefs";
import { useChatUnread } from "@/hooks/use-chat-unread";

export function MobileNav({ permissions, currentUserId }: { permissions: string[]; currentUserId: string }) {
  const pathname = usePathname();
  const hasUnread = useChatUnread(currentUserId);
  const [prefs, setPrefs] = useState<NavPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    setPrefs(loadNavPrefs());
  }, []);

  // Re-read prefs when the settings page changes them
  useEffect(() => {
    function onPrefsChanged() { setPrefs(loadNavPrefs()); }
    window.addEventListener("nav-prefs-changed", onPrefsChanged);
    return () => window.removeEventListener("nav-prefs-changed", onPrefsChanged);
  }, []);

  function getOrderedItems(groupId: string, items: NavItem[]): NavItem[] {
    const custom = prefs.groupItemOrder[groupId] ?? [];
    const hrefs = applyOrder(items.map((i) => i.href), custom);
    const map = new Map(items.map((i) => [i.href, i]));
    return hrefs.map((h) => map.get(h)!).filter(Boolean);
  }

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-[var(--skin-header-bg)] border-t border-[var(--skin-border)] z-40">
      <div className="flex items-center py-2 overflow-x-auto scrollbar-none px-2 gap-0.5">
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
                const showDot = item.href === "/chat" && hasUnread && !isActive;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors shrink-0",
                      isActive ? "text-[var(--skin-active-text)]" : "text-[var(--skin-sidebar-text)]"
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
      </div>
    </nav>
  );
}
