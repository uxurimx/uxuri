"use client";

import { useState, useEffect, useRef } from "react";
import { Send } from "lucide-react";

interface ContextEntry {
  id: string;
  entityType: string;
  entityId: string;
  content: string;
  userId: string | null;
  userName: string | null;
  createdAt: string | Date;
}

interface ContextFeedProps {
  entityType: "client" | "project" | "objective";
  entityId: string;
}

function timeAgo(date: string | Date): string {
  const d = new Date(date);
  const now = Date.now();
  const diff = Math.floor((now - d.getTime()) / 1000);
  if (diff < 60) return "hace un momento";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function ContextFeed({ entityType, entityId }: ContextFeedProps) {
  const [entries, setEntries] = useState<ContextEntry[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/context-entries?entityType=${entityType}&entityId=${entityId}`)
      .then((r) => r.json())
      .then((data) => {
        setEntries(Array.isArray(data) ? data : []);
      })
      .finally(() => setLoading(false));
  }, [entityType, entityId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      const res = await fetch("/api/context-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, entityId, content: trimmed }),
      });
      if (res.ok) {
        const entry = await res.json();
        setEntries((prev) => [...prev, entry]);
        setContent("");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-slate-900 text-sm">Contexto</h3>

      {/* Timeline */}
      <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
        {loading ? (
          <p className="text-xs text-slate-400">Cargando...</p>
        ) : entries.length === 0 ? (
          <p className="text-xs text-slate-400">
            No hay entradas de contexto todavía. Añade notas o eventos relevantes.
          </p>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="flex gap-3">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#1e3a5f] flex items-center justify-center">
                <span className="text-white text-[10px] font-bold">
                  {getInitials(entry.userName)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="text-xs font-medium text-slate-700">
                    {entry.userName ?? "Usuario"}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {timeAgo(entry.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-slate-600 whitespace-pre-line">{entry.content}</p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e as unknown as React.FormEvent);
            }
          }}
          placeholder="Añadir nota de contexto..."
          rows={2}
          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 resize-none"
        />
        <button
          type="submit"
          disabled={sending || !content.trim()}
          className="self-end px-3 py-2 bg-[#1e3a5f] text-white rounded-lg hover:bg-[#162d4a] transition-colors disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
