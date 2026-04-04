"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Send, Zap, Archive, Loader2, Map,
  CheckSquare, FolderOpen, Target, StickyNote,
  CheckCircle, Bot, Plus, X as XIcon,
} from "lucide-react";
import { PlanningActionsPanel } from "./planning-actions-panel";
import { PlanningMindmap } from "./planning-mindmap";
import { cn } from "@/lib/utils";
import { getPusherClient } from "@/lib/pusher";
import type { PlanningMessageMetadata } from "@/db/schema/planning-messages";

type Message = {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  metadata: PlanningMessageMetadata | null;
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

const SLASH_COMMANDS = [
  { cmd: "bot",      Icon: Bot,         hint: "Consultar al asistente AI" },
  { cmd: "tarea",    Icon: CheckSquare, hint: "Crear tarea rápida" },
  { cmd: "proyecto", Icon: FolderOpen,  hint: "Crear proyecto nuevo" },
  { cmd: "nota",     Icon: StickyNote,  hint: "Guardar nota" },
  { cmd: "objetivo", Icon: Target,      hint: "Crear objetivo" },
] as const;

const COMMAND_MAP: Record<string, "task" | "project" | "objective" | "note"> = {
  tarea: "task",
  proyecto: "project",
  objetivo: "objective",
  nota: "note",
};

const COMMAND_META: Record<string, { Icon: typeof CheckSquare; label: string }> = {
  task:      { Icon: CheckSquare, label: "Tarea" },
  project:   { Icon: FolderOpen,  label: "Proyecto" },
  objective: { Icon: Target,      label: "Objetivo" },
  note:      { Icon: StickyNote,  label: "Nota" },
};

// ── Hash command parsing ──────────────────────────────────────────────────────
// Supports: #tarea:NAME:DESC  #proyecto:NAME  #nota:NAME  #objetivo:NAME

type HashCommand = {
  type: "task" | "project" | "objective" | "note";
  title: string;
  description?: string;
};

const HASH_TYPE_MAP: Record<string, "task" | "project" | "objective" | "note"> = {
  tarea: "task",
  proyecto: "project",
  objetivo: "objective",
  nota: "note",
};

function parseHashCommands(text: string): HashCommand[] {
  const pattern = /#(tarea|proyecto|nota|objetivo):([^:#\n\s][^:#\n]*)(?::([^#\n]+))?/gi;
  const results: HashCommand[] = [];
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const type = HASH_TYPE_MAP[match[1].toLowerCase()];
    if (type) {
      results.push({
        type,
        title: match[2].trim(),
        description: match[3]?.trim() || undefined,
      });
    }
  }
  return results;
}

// Render user message text with #hashtag commands highlighted
function renderMessageText(content: string): React.ReactNode {
  const parts = content.split(/(#(?:tarea|proyecto|nota|objetivo):[^\s#\n][^#\n]*)/gi);
  return parts.map((part, i) =>
    /^#(?:tarea|proyecto|nota|objetivo):/i.test(part) ? (
      <span key={i} className="bg-white/20 text-white px-1.5 py-0.5 rounded font-mono text-xs">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export function PlanningSession({ session: initialSession }: { session: Session }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialSession.messages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [showMindmap, setShowMindmap] = useState(false);
  const [title, setTitle] = useState(initialSession.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const [selectedCmdIdx, setSelectedCmdIdx] = useState(0);
  const [showActionsDrawer, setShowActionsDrawer] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Slash command autocomplete state
  const isSlashOnly = input.startsWith("/") && !input.includes(" ");
  const slashQuery = isSlashOnly ? input.slice(1).toLowerCase() : null;
  const slashCmds = slashQuery !== null
    ? SLASH_COMMANDS.filter((c) => c.cmd.startsWith(slashQuery))
    : [];
  const showSlashMenu = slashCmds.length > 0;

  useEffect(() => {
    if (showSlashMenu) setSelectedCmdIdx(0);
  }, [slashQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages, showTyping]);

  // Pusher: escuchar mensajes del agente externo (MCP)
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

  function optimistic(content: string): Message {
    return {
      id: `tmp-${Date.now()}`,
      sessionId: initialSession.id,
      role: "user",
      content,
      metadata: null,
      createdAt: new Date().toISOString(),
    };
  }

  async function saveNote(content: string) {
    setMessages((prev) => [...prev, optimistic(content)]);
    await fetch(`/api/planning/${initialSession.id}/note`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
  }

  async function sendToAI(text: string, displayContent: string) {
    setMessages((prev) => [...prev, optimistic(displayContent)]);
    setLoading(true);
    setShowTyping(true);
    try {
      const res = await fetch(`/api/planning/${initialSession.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      if (res.ok) {
        const { message } = await res.json();
        setMessages((prev) => [...prev, message]);
      }
    } finally {
      setLoading(false);
      setShowTyping(false);
    }
  }

  async function executeCommand(
    commandType: "task" | "project" | "objective" | "note",
    entityTitle: string,
    rawInput: string
  ) {
    setMessages((prev) => [...prev, optimistic(rawInput)]);
    setLoading(true);
    try {
      const res = await fetch(`/api/planning/${initialSession.id}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: commandType, title: entityTitle, rawInput }),
      });
      if (res.ok) {
        const { resultMessage } = await res.json();
        setMessages((prev) => [...prev, resultMessage]);
      }
    } finally {
      setLoading(false);
    }
  }

  // Execute all hash commands found in a piece of text.
  // The full text is saved once as a user note; each entity is created via
  // /command with skipUserMessage so we don't duplicate the message row.
  async function executeHashCommands(content: string, cmds: HashCommand[]) {
    setMessages((prev) => [...prev, optimistic(content)]);
    setLoading(true);
    try {
      // Persist the full natural-language text once
      await fetch(`/api/planning/${initialSession.id}/note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      // Create each entity and append its result bubble
      for (const cmd of cmds) {
        const res = await fetch(`/api/planning/${initialSession.id}/command`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            command: cmd.type,
            title: cmd.title,
            description: cmd.description,
            rawInput: content,
            skipUserMessage: true,
          }),
        });
        if (res.ok) {
          const { resultMessage } = await res.json();
          setMessages((prev) => [...prev, resultMessage]);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const content = input.trim();
    setInput("");

    // 1. Slash command (must be at the start)
    if (content.startsWith("/")) {
      const spaceIdx = content.indexOf(" ");
      const cmd = (spaceIdx === -1 ? content.slice(1) : content.slice(1, spaceIdx)).toLowerCase();
      const rest = spaceIdx === -1 ? "" : content.slice(spaceIdx + 1).trim();

      if (cmd === "bot") {
        await sendToAI(rest || "Hola", content);
        return;
      }

      const commandType = COMMAND_MAP[cmd];
      if (commandType) {
        await executeCommand(commandType, rest || "Sin título", content);
        return;
      }
    }

    // 2. Inline hash commands anywhere in the text
    const hashCmds = parseHashCommands(content);
    if (hashCmds.length > 0) {
      await executeHashCommands(content, hashCmds);
      return;
    }

    // 3. Plain note
    await saveNote(content);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (showSlashMenu) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedCmdIdx((i) => Math.min(i + 1, slashCmds.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedCmdIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        const selected = slashCmds[selectedCmdIdx];
        if (selected) setInput(`/${selected.cmd} `);
        return;
      }
      if (e.key === "Escape") {
        setInput("");
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
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

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  }

  const contextLabel: Record<string, string> = {
    blank: "Sesión libre", task: "Tarea", project: "Proyecto",
    objective: "Objetivo", client: "Cliente",
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden -m-6">

      {/* Mobile drawer backdrop */}
      {showActionsDrawer && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setShowActionsDrawer(false)}
        />
      )}

      {/* LEFT: Actions Panel — desktop always visible, mobile as drawer */}
      <div className={cn(
        "flex-shrink-0 border-r border-slate-200 bg-slate-50 overflow-y-auto transition-transform duration-200",
        // Desktop: always visible, fixed width
        "hidden md:block md:w-64",
      )}>
        <PlanningActionsPanel
          sessionId={initialSession.id}
          contextType={initialSession.contextType}
          contextSnapshot={initialSession.contextSnapshot}
        />
      </div>

      {/* Mobile drawer */}
      <div className={cn(
        "md:hidden fixed left-0 top-0 bottom-0 z-50 w-72 bg-slate-50 border-r border-slate-200 overflow-y-auto transition-transform duration-200 flex flex-col",
        showActionsDrawer ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between px-4 h-14 border-b border-slate-200 flex-shrink-0 bg-white">
          <span className="text-sm font-semibold text-slate-800">Crear desde sesión</span>
          <button
            onClick={() => setShowActionsDrawer(false)}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <PlanningActionsPanel
            sessionId={initialSession.id}
            contextType={initialSession.contextType}
            contextSnapshot={initialSession.contextSnapshot}
          />
        </div>
      </div>

      {/* CENTER: Minuta */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-3 md:px-4 gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Mobile: drawer toggle */}
            <button
              onClick={() => setShowActionsDrawer(true)}
              className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-[#1e3a5f] hover:bg-slate-50 transition-colors flex-shrink-0"
              title="Crear tarea / proyecto / objetivo"
            >
              <Plus className="w-4 h-4" />
            </button>

            <Zap className="hidden md:block w-4 h-4 text-[#1e3a5f] flex-shrink-0" />
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
                className="text-sm font-semibold text-slate-900 hover:text-[#1e3a5f] truncate text-left flex-1 min-w-0"
              >
                {title}
              </button>
            )}
            {initialSession.contextType !== "blank" && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 flex-shrink-0 hidden sm:inline">
                {contextLabel[initialSession.contextType] ?? initialSession.contextType}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowMindmap(!showMindmap)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors",
                showMindmap
                  ? "bg-[#1e3a5f] text-white"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-50"
              )}
            >
              <Map className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mapa</span>
            </button>
            <button
              onClick={archive}
              className="flex items-center gap-1.5 px-2.5 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs hover:bg-slate-50 transition-colors"
            >
              <Archive className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Archivar</span>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Minuta de sesión</p>
              <p className="text-sm mt-1">
                Escribe tus notas. Usa{" "}
                <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 text-xs">/bot</code>{" "}
                para el asistente o{" "}
                <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 text-xs">#tarea:Nombre</code>{" "}
                para crear entidades al vuelo.
              </p>
            </div>
          )}

          {messages.map((msg) => {
            // Command result bubble
            if (msg.metadata?.commandType) {
              const meta = COMMAND_META[msg.metadata.commandType];
              const Icon = meta?.Icon ?? CheckCircle;
              return (
                <div key={msg.id} className="flex gap-3 items-end">
                  <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-teal-50 border border-teal-200 rounded-2xl rounded-tl-sm px-4 py-3 text-sm shadow-sm">
                    <div className="flex items-center gap-1.5 text-teal-700 font-medium text-xs mb-1">
                      <CheckCircle className="w-3.5 h-3.5" />
                      {meta?.label ?? "Elemento"} creado
                    </div>
                    <div className="text-slate-800 font-medium">"{msg.metadata.entityTitle}"</div>
                    <a
                      href={msg.metadata.url}
                      className="text-teal-600 text-xs mt-1 block hover:underline"
                    >
                      Ver {meta?.label?.toLowerCase() ?? "elemento"} →
                    </a>
                  </div>
                  <span className="text-xs text-slate-400 mb-1 flex-shrink-0">
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
              );
            }

            // User message
            if (msg.role === "user") {
              return (
                <div key={msg.id} className="flex gap-2 justify-end items-end">
                  <span className="text-xs text-slate-400 flex-shrink-0">
                    {formatTime(msg.createdAt)}
                  </span>
                  <div className="max-w-[75%] rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed bg-[#1e3a5f] text-white">
                    <div className="whitespace-pre-wrap">{renderMessageText(msg.content)}</div>
                  </div>
                </div>
              );
            }

            // Assistant message (/bot response)
            return (
              <div key={msg.id} className="flex gap-3 items-end">
                <div className="w-8 h-8 rounded-full bg-[#1e3a5f] flex items-center justify-center flex-shrink-0">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <div className="max-w-[75%] rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed bg-white border border-slate-200 text-slate-900 shadow-sm">
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
                <span className="text-xs text-slate-400 mb-1 flex-shrink-0">
                  {formatTime(msg.createdAt)}
                </span>
              </div>
            );
          })}

          {showTyping && (
            <div className="flex gap-3 items-center">
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

        {/* Input area */}
        <div className="border-t border-slate-200 bg-white p-3">
          <div className="relative flex gap-2 items-end">
            {/* Slash command popup */}
            {showSlashMenu && (
              <div className="absolute bottom-full left-0 mb-2 w-72 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-50">
                {slashCmds.map((c, i) => (
                  <button
                    key={c.cmd}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                      selectedCmdIdx === i ? "bg-slate-100" : "hover:bg-slate-50"
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setInput(`/${c.cmd} `);
                      textareaRef.current?.focus();
                    }}
                  >
                    <c.Icon className="w-4 h-4 text-[#1e3a5f] flex-shrink-0" />
                    <span className="font-mono text-sm text-[#1e3a5f] font-semibold">/{c.cmd}</span>
                    <span className="text-xs text-slate-400">{c.hint}</span>
                  </button>
                ))}
              </div>
            )}

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu nota... /bot para AI · #tarea:Nombre · #proyecto:Nombre"
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
