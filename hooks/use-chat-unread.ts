"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getPusherClient } from "@/lib/pusher";
import { getUnread, addUnread, UNREAD_EVENT } from "@/lib/unread-store";
import type { Channel as PusherChannel } from "pusher-js";

export function useChatUnread(currentUserId: string): boolean {
  const [hasUnread, setHasUnread] = useState(false);
  const pathname = usePathname();

  // Sync local state from the store whenever it changes
  useEffect(() => {
    function sync() {
      setHasUnread(getUnread().size > 0);
    }
    sync();
    window.addEventListener(UNREAD_EVENT, sync);
    return () => window.removeEventListener(UNREAD_EVENT, sync);
  }, []);

  // Clear the indicator when user navigates to /chat
  useEffect(() => {
    // We don't wipe the store here — ChatClient clears per channel when opened.
    // We just hide the nav dot while the user is in /chat.
    if (pathname.startsWith("/chat")) {
      setHasUnread(false);
    }
  }, [pathname]);

  // Subscribe to all accessible channels to detect incoming messages
  useEffect(() => {
    const pusher = getPusherClient();
    const bound: Array<{ pCh: PusherChannel; handler: (msg: { userId: string }) => void }> = [];

    fetch("/api/chat/channels")
      .then((r) => r.json())
      .then((channels: { id: string }[]) => {
        if (!Array.isArray(channels)) return;

        channels.forEach((ch) => {
          const pCh = pusher.subscribe(`chat-${ch.id}`);
          const handler = (msg: { userId: string }) => {
            if (msg.userId === currentUserId) return;
            // Don't mark unread if user is actively viewing this channel
            if (
              window.location.pathname === "/chat" &&
              new URLSearchParams(window.location.search).get("ch") === ch.id
            ) return;
            addUnread(ch.id);
          };
          pCh.bind("message:new", handler);
          bound.push({ pCh, handler });
        });
      })
      .catch(() => {});

    return () => {
      // Only unbind our specific handlers — never call pusher.unsubscribe()
      // so other components (MessageThread, ChatClient) keep their subscriptions.
      bound.forEach(({ pCh, handler }) => pCh.unbind("message:new", handler));
    };
  }, [currentUserId]);

  return hasUnread;
}
