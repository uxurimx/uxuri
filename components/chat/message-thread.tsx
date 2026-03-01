"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getPusherClient } from "@/lib/pusher";
import { formatDateTime, cn } from "@/lib/utils";
import { MessageInput } from "./message-input";
import { Download, FileText, Image as ImageIcon } from "lucide-react";
import type { ChatMessage } from "@/db/schema";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(fileType: string | null): boolean {
  return !!fileType?.startsWith("image/");
}

function Avatar({ name, isSelf }: { name: string; isSelf: boolean }) {
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className={cn(
      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
      isSelf ? "bg-[#1e3a5f] text-white" : "bg-slate-200 text-slate-600"
    )}>
      {initials}
    </div>
  );
}

function FileAttachment({ msg }: { msg: ChatMessage }) {
  if (!msg.fileUrl) return null;

  if (isImage(msg.fileType)) {
    return (
      <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="block mt-1">
        <img
          src={msg.fileUrl}
          alt={msg.fileName ?? "imagen"}
          className="max-w-[240px] max-h-48 rounded-lg object-cover border border-white/20 hover:opacity-90 transition-opacity"
        />
      </a>
    );
  }

  return (
    <a
      href={msg.fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 mt-1 px-3 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors max-w-[240px]"
    >
      <FileText className="w-4 h-4 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{msg.fileName ?? "archivo"}</p>
        {msg.fileSize && (
          <p className="text-[10px] opacity-70">{formatBytes(msg.fileSize)}</p>
        )}
      </div>
      <Download className="w-3.5 h-3.5 flex-shrink-0 opacity-70" />
    </a>
  );
}

export function MessageThread({
  channelId,
  currentUserId,
}: {
  channelId: string;
  currentUserId: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async (before?: string) => {
    const url = before
      ? `/api/chat/channels/${channelId}/messages?before=${encodeURIComponent(before)}`
      : `/api/chat/channels/${channelId}/messages`;
    const res = await fetch(url);
    const data: ChatMessage[] = await res.json();
    return data;
  }, [channelId]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    setMessages([]);
    fetchMessages()
      .then((data) => {
        setMessages(data);
        setHasMore(data.length === 50);
      })
      .finally(() => setLoading(false));
  }, [channelId, fetchMessages]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (!loading) {
      bottomRef.current?.scrollIntoView();
    }
  }, [loading]);

  // Auto-scroll on new message (only if near bottom)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  // Pusher real-time
  useEffect(() => {
    const pusher = getPusherClient();
    const channel = pusher.subscribe(`chat-${channelId}`);
    channel.bind("message:new", (msg: ChatMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });
    return () => {
      channel.unbind_all();
      pusher.unsubscribe(`chat-${channelId}`);
    };
  }, [channelId]);

  async function loadMore() {
    if (!messages[0] || loadingMore) return;
    setLoadingMore(true);
    const oldHeight = containerRef.current?.scrollHeight ?? 0;
    const older = await fetchMessages(new Date(messages[0].createdAt).toISOString());
    setMessages((prev) => [...older, ...prev]);
    setHasMore(older.length === 50);
    setLoadingMore(false);
    // Restore scroll position
    requestAnimationFrame(() => {
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight - oldHeight;
      }
    });
  }

  async function handleSend(payload: { content?: string; file?: { url: string; name: string; type: string; size: number } }) {
    const body = {
      content: payload.content,
      fileUrl: payload.file?.url,
      fileName: payload.file?.name,
      fileType: payload.file?.type,
      fileSize: payload.file?.size,
    };
    await fetch(`/api/chat/channels/${channelId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        Cargando mensajes...
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Messages */}
      <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {hasMore && (
          <div className="flex justify-center">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="text-xs text-slate-400 hover:text-slate-600 py-1"
            >
              {loadingMore ? "Cargando..." : "Cargar mensajes anteriores"}
            </button>
          </div>
        )}

        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400">
            <p className="text-sm">Sin mensajes aún.</p>
            <p className="text-xs mt-1">¡Sé el primero en escribir!</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const isSelf = msg.userId === currentUserId;
          const prevMsg = messages[i - 1];
          const showAvatar = !prevMsg || prevMsg.userId !== msg.userId;

          return (
            <div
              key={msg.id}
              className={cn("flex items-end gap-2", isSelf ? "flex-row-reverse" : "flex-row")}
            >
              {showAvatar ? (
                <Avatar name={msg.userName} isSelf={isSelf} />
              ) : (
                <div className="w-8 flex-shrink-0" />
              )}

              <div className={cn("max-w-[72%] flex flex-col", isSelf ? "items-end" : "items-start")}>
                {showAvatar && (
                  <span className="text-[10px] text-slate-400 mb-0.5 px-1">
                    {isSelf ? "Tú" : msg.userName}
                  </span>
                )}
                <div
                  className={cn(
                    "px-3 py-2 rounded-2xl text-sm leading-relaxed",
                    isSelf
                      ? "bg-[#1e3a5f] text-white rounded-br-sm"
                      : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm"
                  )}
                >
                  {msg.content && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
                  <FileAttachment msg={msg} />
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 px-1">
                  {formatDateTime(msg.createdAt)}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <MessageInput onSend={handleSend} />
    </div>
  );
}
