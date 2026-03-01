"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getPusherClient } from "@/lib/pusher";

export function useChatUnread(currentUserId: string) {
  const [hasUnread, setHasUnread] = useState(false);
  const pathname = usePathname();

  // Clear indicator when the user navigates to /chat
  useEffect(() => {
    if (pathname.startsWith("/chat")) {
      setHasUnread(false);
    }
  }, [pathname]);

  useEffect(() => {
    let channelIds: string[] = [];
    const pusher = getPusherClient();

    fetch("/api/chat/channels")
      .then((r) => r.json())
      .then((channels: { id: string }[]) => {
        if (!Array.isArray(channels)) return;
        channelIds = channels.map((c) => c.id);

        channels.forEach((ch) => {
          const pCh = pusher.subscribe(`chat-${ch.id}`);
          pCh.bind("message:new", (msg: { userId: string }) => {
            if (msg.userId === currentUserId) return; // own message — ignore
            // Don't mark unread if user is actively viewing this channel
            if (
              window.location.pathname === "/chat" &&
              new URLSearchParams(window.location.search).get("ch") === ch.id
            ) return;
            setHasUnread(true);
          });
        });
      })
      .catch(() => {});

    return () => {
      channelIds.forEach((id) => pusher.unsubscribe(`chat-${id}`));
    };
  }, [currentUserId]);

  return hasUnread;
}
