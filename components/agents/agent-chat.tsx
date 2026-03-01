"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPusherClient } from "@/lib/pusher";

type Message = {
  id: string;
  taskId: string;
  role: "agent" | "user";
  content: string;
  createdAt: string;
};

interface AgentChatProps {
  taskId: string;
  agentStatus: string | null;
}

export function AgentChat({ taskId, agentStatus }: AgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Fetch initial messages
  useEffect(() => {
    setLoading(true);
    fetch(`/api/agent-messages?taskId=${taskId}`)
      .then((r) => r.json())
      .then((data) => setMessages(Array.isArray(data) ? data : []))
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [taskId]);

  // Subscribe to Pusher real-time messages
  useEffect(() => {
    const pusher = getPusherClient();
    const channel = pusher.subscribe(`task-${taskId}`);

    channel.bind("agent:message", (data: Message) => {
      setMessages((prev) => {
        // Avoid duplicates
        if (prev.some((m) => m.id === data.id)) return prev;
        return [...prev, data];
      });
    });

    return () => {
      channel.unbind("agent:message");
      pusher.unsubscribe(`task-${taskId}`);
    };
  }, [taskId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setInput("");
    try {
      await fetch("/api/agent-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, content }),
      });
      // Message will arrive via Pusher
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const isAgentBusy = agentStatus === "analyzing" || agentStatus === "working";

  return (
    <div className="flex flex-col h-64 border border-slate-200 rounded-xl overflow-hidden">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-slate-50">
        {loading ? (
          <p className="text-xs text-slate-400 text-center py-4">Cargando mensajes…</p>
        ) : messages.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">
            El agente recibirá esta tarea y puede hacer preguntas aquí.
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-2 max-w-[85%]",
                msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
              )}
            >
              <div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                  msg.role === "agent"
                    ? "bg-[#1e3a5f] text-white"
                    : "bg-slate-200 text-slate-600"
                )}
              >
                {msg.role === "agent" ? (
                  <Bot className="w-3 h-3" />
                ) : (
                  <User className="w-3 h-3" />
                )}
              </div>
              <div
                className={cn(
                  "px-3 py-2 rounded-xl text-sm leading-relaxed",
                  msg.role === "agent"
                    ? "bg-[#1e3a5f] text-white rounded-tl-none"
                    : "bg-white text-slate-800 rounded-tr-none border border-slate-200"
                )}
              >
                {msg.content}
              </div>
            </div>
          ))
        )}
        {isAgentBusy && (
          <div className="flex gap-2 max-w-[85%] mr-auto">
            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-[#1e3a5f] text-white">
              <Bot className="w-3 h-3" />
            </div>
            <div className="px-3 py-2 rounded-xl rounded-tl-none bg-[#1e3a5f]/10 text-slate-500 text-xs italic flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1e3a5f] animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#1e3a5f] animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#1e3a5f] animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-end gap-2 px-3 py-2 border-t border-slate-200 bg-white">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Responde al agente… (Enter para enviar)"
          className="flex-1 text-sm resize-none border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] placeholder:text-slate-300 max-h-20 overflow-y-auto"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="p-2 rounded-lg bg-[#1e3a5f] text-white hover:bg-[#162d4a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
