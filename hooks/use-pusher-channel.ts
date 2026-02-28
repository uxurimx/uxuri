"use client";

import { useEffect, useRef } from "react";
import { getPusherClient } from "@/lib/pusher";
import type { Channel } from "pusher-js";

type EventHandler = (data: unknown) => void;

export function usePusherChannel(
  channelName: string,
  eventName: string,
  handler: EventHandler
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const pusher = getPusherClient();
    const channel: Channel = pusher.subscribe(channelName);

    channel.bind(eventName, (data: unknown) => {
      handlerRef.current(data);
    });

    return () => {
      channel.unbind(eventName);
      pusher.unsubscribe(channelName);
    };
  }, [channelName, eventName]);
}
