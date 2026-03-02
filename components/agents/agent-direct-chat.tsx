"use client";

import { useEffect, useRef, useState } from "react";
import { getPusherClient } from "@/lib/pusher";
import { formatDateTime, cn } from "@/lib/utils";
import { Send, Bot } from "lucide-react";

type Msg = {
  id: string;
  channelId: string;
  userId: string | null;
  agentId: string | null;
  userName: string | null;
  content: string | null;
  createdAt: string;
};

type TypingState = { agentId: string; agentName: string } | null;

interface Props {
  agentId: string;
  agentName: string;
  agentAvatar: string;
  agentColor: string;
  currentUserId: string;
}

export function AgentDirectChat({ agentId, agentName, agentAvatar, agentColor, currentUserId }: Props) {
  const [channelId, setChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState<TypingState>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Find or create the agent-dm channel
  useEffect(() => {
    fetch(`/api/chat/channels/agent?agentId=${agentId}`)
      .then((r) => r.json())
      .then(async (ch) => {
        setChannelId(ch.id);
        const res = await fetch(`/api/chat/channels/${ch.id}/messages`);
        const data = await res.json();
        setMessages(Array.isArray(data) ? data : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [agentId]);

  // Pusher subscription
  useEffect(() => {
    if (!channelId) return;
    const pusher = getPusherClient();
    const ch = pusher.subscribe(`chat-${channelId}`);

    ch.bind("message:new", (msg: Msg) => {
      setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
      if (msg.agentId) setTyping(null);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    });
    ch.bind("agent:typing", (data: { agentId: string; agentName: string }) => {
      setTyping(data);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    });
    ch.bind("agent:typing-stop", () => setTyping(null));

    return () => {
      ch.unbind_all();
      pusher.unsubscribe(`chat-${channelId}`);
    };
  }, [channelId]);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    if (!channelId || !text.trim() || sending) return;
    setSending(true);
    const content = text.trim();
    setText("");
    try {
      const res = await fetch(`/api/chat/channels/${channelId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const msg = await res.json();
        setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
        Cargando conversación...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-slate-400 text-sm gap-2">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
              style={{ backgroundColor: agentColor + "20" }}
            >
              {agentAvatar}
            </div>
            <p>Inicia una conversación con <span className="font-medium text-slate-600">{agentName}</span></p>
          </div>
        )}

        {messages.map((msg) => {
          const isAgent = !!msg.agentId;
          const isSelf = msg.userId === currentUserId;

          return (
            <div key={msg.id} className={cn("flex gap-2.5", isSelf && "flex-row-reverse")}>
              {/* Avatar */}
              {isAgent ? (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0"
                  style={{ backgroundColor: agentColor + "20" }}
                >
                  {agentAvatar}
                </div>
              ) : (
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                  isSelf ? "bg-[#1e3a5f] text-white" : "bg-slate-200 text-slate-600"
                )}>
                  {(msg.userName ?? "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
              )}

              {/* Bubble */}
              <div className={cn("flex flex-col gap-0.5 max-w-[72%]", isSelf && "items-end")}>
                <span className="text-[10px] text-slate-400 px-1">{msg.userName}</span>
                <div className={cn(
                  "rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                  isAgent
                    ? "bg-slate-100 text-slate-800 rounded-tl-sm"
                    : isSelf
                    ? "bg-[#1e3a5f] text-white rounded-tr-sm"
                    : "bg-slate-100 text-slate-800 rounded-tl-sm"
                )}>
                  {msg.content}
                </div>
                <span className="text-[10px] text-slate-400 px-1">
                  {formatDateTime(msg.createdAt)}
                </span>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {typing && (
          <div className="flex gap-2.5 items-center">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0"
              style={{ backgroundColor: agentColor + "20" }}
            >
              {agentAvatar}
            </div>
            <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-3.5 py-2.5 flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 p-3 border-t border-slate-100">
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={`Mensaje a ${agentName}...`}
            disabled={sending}
            className="flex-1 text-sm px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={sending || !text.trim()}
            className="px-3 py-2 bg-[#1e3a5f] text-white rounded-xl hover:bg-[#162d4a] transition-colors disabled:opacity-40 flex items-center gap-1.5"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
