"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { X, CheckCircle, Info, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "info" | "success" | "warning";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

export interface Notification {
  id: string;
  message: string;
  type: ToastType;
  timestamp: Date;
  read: boolean;
}

interface ToastContextValue {
  addToast: (message: string, type?: ToastType) => void;
  addNotification: (message: string, type?: ToastType) => void;
  notifications: Notification[];
  unreadCount: number;
  markAllRead: () => void;
  clearNotifications: () => void;
}

const ToastContext = createContext<ToastContextValue>({
  addToast: () => {},
  addNotification: () => {},
  notifications: [],
  unreadCount: 0,
  markAllRead: () => {},
  clearNotifications: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

const icons = {
  info:    <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />,
  success: <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />,
  warning: <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />,
};

const styles = {
  info:    "border-blue-200 bg-blue-50",
  success: "border-emerald-200 bg-emerald-50",
  warning: "border-amber-200 bg-amber-50",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 6000);
  }, []);

  const addNotification = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).slice(2);
    // Add to persistent notification list
    setNotifications((prev) => [
      { id, message, type, timestamp: new Date(), read: false },
      ...prev.slice(0, 49), // keep max 50
    ]);
    // Also show ephemeral toast
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 6000);
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ addToast, addNotification, notifications, unreadCount, markAllRead, clearNotifications }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg pointer-events-auto",
              styles[toast.type]
            )}
          >
            {icons[toast.type]}
            <p className="text-sm text-slate-700 flex-1 leading-snug">{toast.message}</p>
            <button onClick={() => dismiss(toast.id)} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
