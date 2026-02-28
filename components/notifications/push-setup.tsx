"use client";

import { useEffect, useState } from "react";
import { BellOff, BellRing, Loader2 } from "lucide-react";

export function PushSetup() {
  const [status, setStatus] = useState<"loading" | "unsupported" | "denied" | "subscribed" | "idle">("loading");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }

    // Register service worker
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(async (reg) => {
        const existing = await reg.pushManager.getSubscription();
        if (existing) {
          setStatus("subscribed");
        } else if (Notification.permission === "denied") {
          setStatus("denied");
        } else {
          setStatus("idle");
        }
      })
      .catch(() => setStatus("unsupported"));
  }, []);

  async function enable() {
    try {
      setStatus("loading");
      const reg = await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) as BufferSource,
      });

      const json = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint, keys: json.keys }),
      });

      setStatus("subscribed");
    } catch {
      setStatus("idle");
    }
  }

  if (status === "unsupported" || status === "subscribed") return null;

  return (
    <div className="flex items-center gap-2">
      {status === "denied" ? (
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <BellOff className="w-3.5 h-3.5" />
          Notificaciones bloqueadas
        </span>
      ) : (
        <button
          onClick={enable}
          disabled={status === "loading"}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#1e3a5f] transition-colors disabled:opacity-50"
          title="Habilitar notificaciones push"
        >
          {status === "loading" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <BellRing className="w-3.5 h-3.5" />
          )}
          Habilitar notificaciones
        </button>
      )}
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}
