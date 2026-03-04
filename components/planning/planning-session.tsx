"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Send, Zap, Plus, Archive, Loader2, Map } from "lucide-react";
import { PlanningActionsPanel } from "./planning-actions-panel";
import { PlanningMindmap } from "./planning-mindmap";
import { cn } from "@/lib/utils";
import { getPusherClient } from "@/lib/pusher";

type Message = {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

type Session = {
  id: string;
  title: string;
  contextType: string;
  contextId: string | null;
  contextSnapshot: Record<string, unknown> | null;
  mindmapData: Record<string, unknown> | null;
  status: "active" | "archived";
  messages: Message[];
};

export function PlanningSession({ session: initialSession }: { session: Session }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialSession.messages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showMindmap, setShowMindmap] = useState(false);
  const [title, setTitle] = useState(initialSession.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Escuchar mensajes del agente externo (Planning Agent MCP via Pusher)
  useEffect(() => {
    const pusher = getPusherClient();
    const channel = pusher.subscribe(`planning-${initialSession.id}`);
    channel.bind("planning:message", (data: Message) => {
      setMessages((prev) => {
        if (prev.find((m) => m.id === data.id)) return prev;
        return [...prev, data];
      });
    });
    return () => {
      channel.unbind_all();
      pusher.unsubscribe(`planning-${initialSession.id}`);
    };
  }, [initialSession.id]);

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const content = input.trim();
    setInput("");

    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      sessionId: initialSession.id,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setLoading(true);

    try {
      const res = await fetch(`/api/planning/${initialSession.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const { message } = await res.json();
        setMessages((prev) => [...prev, message]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function saveTitle(newTitle: string) {
    setEditingTitle(false);
    if (newTitle === initialSession.title) return;
    setTitle(newTitle);
    await fetch(`/api/planning/${initialSession.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle }),
    });
  }

  async function archive() {
    if (!confirm("¿Archivar esta sesión?")) return;
    await fetch(`/api/planning/${initialSession.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
    router.push("/planning");
  }

  const contextLabel: Record<string, string> = {
    blank: "Sesión libre",
    task: "Tarea",
    project: "Proyecto",
    objective: "Objetivo",
    client: "Cliente",
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden -m-6">
      {/* LEFT: Actions Panel */}
      <div className="w-64 flex-shrink-0 border-r border-slate-200 bg-slate-50 overflow-y-auto">
        <PlanningActionsPanel
          sessionId={initialSession.id}
          contextType={initialSession.contextType}
          contextSnapshot={initialSession.contextSnapshot}
        />
      </div>

      {/* CENTER: Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-4 gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Zap className="w-4 h-4 text-[#1e3a5f] flex-shrink-0" />
            {editingTitle ? (
              <input
                autoFocus
                defaultValue={title}
                onBlur={(e) => saveTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTitle(e.currentTarget.value);
                  if (e.key === "Escape") setEditingTitle(false);
                }}
                className="flex-1 text-sm font-semibold text-slate-900 bg-transparent border-b border-[#1e3a5f] outline-none"
              />
            ) : (
              <button
                onClick={() => setEditingTitle(true)}
                className="text-sm font-semibold text-slate-900 hover:text-[#1e3a5f] truncate text-left"
              >
                {title}
              </button>
            )}
            {initialSession.contextType !== "blank" && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 flex-shrink-0">
                {contextLabel[initialSession.contextType] ?? initialSession.contextType}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMindmap(!showMindmap)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors",
                showMindmap
                  ? "bg-[#1e3a5f] text-white"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-50"
              )}
            >
              <Map className="w-3.5 h-3.5" />
              Mapa
            </button>
            <button
              onClick={archive}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs hover:bg-slate-50 transition-colors"
            >
              <Archive className="w-3.5 h-3.5" />
              Archivar
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">NEXUS está listo</p>
              <p className="text-sm mt-1">Describe tu idea, problema o contexto para comenzar</p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-3",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-[#1e3a5f] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Zap className="w-4 h-4 text-white" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-[#1e3a5f] text-white rounded-tr-sm"
                    : "bg-white border border-slate-200 text-slate-900 rounded-tl-sm shadow-sm"
                )}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-[#1e3a5f] flex items-center justify-center flex-shrink-0">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-slate-200 bg-white p-3">
          <div className="flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Describe tu idea, problema o contexto... (Enter para enviar)"
              rows={2}
              className="flex-1 resize-none border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="w-10 h-10 flex items-center justify-center bg-[#1e3a5f] text-white rounded-xl hover:bg-[#162d4a] transition-colors disabled:opacity-40"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT: Mindmap (toggleable) */}
      {showMindmap && (
        <div className="w-[360px] flex-shrink-0 border-l border-slate-200 bg-white">
          <PlanningMindmap
            sessionId={initialSession.id}
            initialData={initialSession.mindmapData}
            contextTitle={
              initialSession.contextSnapshot
                ? ((initialSession.contextSnapshot.title ?? initialSession.contextSnapshot.name) as string)
                : initialSession.title
            }
          />
        </div>
      )}
    </div>
  );
}
