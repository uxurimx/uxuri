"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Trash2, Info, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";
import { useToast, type Notification } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const typeIcon = {
  info:    <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />,
  success: <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />,
  warning: <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />,
};

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export function NotificationBell() {
  const { notifications, unreadCount, markAllRead, clearNotifications } = useToast();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  function handleOpen() {
    setOpen((v) => !v);
    if (!open && unreadCount > 0) {
      setTimeout(markAllRead, 300);
    }
  }

  function handleItemClick(n: Notification) {
    setOpen(false);
    if (n.url) router.push(n.url);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors relative"
        title="Notificaciones"
      >
        <Bell className="w-4 h-4 text-slate-500" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-800">Notificaciones</span>
            <div className="flex items-center gap-1">
              {notifications.length > 0 && (
                <>
                  <button
                    onClick={markAllRead}
                    className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    title="Marcar todo como leído"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={clearNotifications}
                    className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Limpiar notificaciones"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Sin notificaciones</p>
              </div>
            ) : (
              notifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onClick={() => handleItemClick(n)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationItem({
  notification: n,
  onClick,
}: {
  notification: Notification;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-3 px-4 py-3 border-b border-slate-50 last:border-0 transition-colors text-left",
        n.url ? "hover:bg-slate-50 cursor-pointer" : "cursor-default",
        !n.read && "bg-blue-50/40"
      )}
    >
      <div className="mt-0.5">{typeIcon[n.type]}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-700 leading-snug">{n.message}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">{timeAgo(n.timestamp)}</p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
        {n.url && <ExternalLink className="w-3 h-3 text-slate-300" />}
        {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
      </div>
    </button>
  );
}
