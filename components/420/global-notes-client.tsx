"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, X, Lightbulb, FileText, Mic, CheckSquare } from "lucide-react";
import { useRouter } from "next/navigation";

interface GlobalNote {
  id: string;
  sessionId: string;
  content: string;
  type: string;
  tags: string[] | null;
  minutesMark: number | null;
  convertedToTask: boolean;
  taskId: string | null;
  createdAt: string;
  sessionType: string;
  sessionStartedAt: string;
}

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  text:    { icon: FileText,    color: "#60a5fa", label: "Nota" },
  insight: { icon: Lightbulb,  color: "#fbbf24", label: "Insight" },
  task:    { icon: CheckSquare, color: "#4ade80", label: "Tarea" },
  voice:   { icon: Mic,         color: "#c084fc", label: "Voz" },
};

const TYPE_EMOJIS: Record<string, string> = {
  sativa: "🌿", indica: "🌑", hybrid: "⚡", cbd: "🌸", hash: "🪨", concentrate: "💎",
};

function formatDate(d: string) {
  const date = new Date(d);
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

interface Props { color: string; }

export function GlobalNotesClient({ color }: Props) {
  const router = useRouter();
  const [notes, setNotes] = useState<GlobalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  useEffect(() => {
    fetch("/api/420/notes")
      .then((r) => r.json())
      .then((d) => setNotes(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = notes.filter((n) => {
    const matchType = typeFilter === "all" || n.type === typeFilter;
    const matchQuery = !query || n.content.toLowerCase().includes(query.toLowerCase());
    return matchType && matchQuery;
  });

  const typeCount = (t: string) => notes.filter((n) => n.type === t).length;

  return (
    <div className="min-h-screen pb-24" style={{ background: "#050a07" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <button
          onClick={() => router.push("/420")}
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "rgba(255,255,255,0.08)", touchAction: "manipulation" }}
        >
          <X className="w-4 h-4 text-white/50" />
        </button>
        <h1 className="font-black text-white text-lg flex-1">Notas globales</h1>
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{notes.length}</span>
      </div>

      {/* Search */}
      <div className="px-5 mb-4">
        <div
          className="flex items-center gap-2 rounded-xl px-4 py-2.5"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <Search className="w-4 h-4 shrink-0" style={{ color: "rgba(255,255,255,0.3)" }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en todas las notas..."
            className="flex-1 bg-transparent text-white placeholder-white/20 outline-none text-sm"
          />
          {query && (
            <button onClick={() => setQuery("")} style={{ touchAction: "manipulation" }}>
              <X className="w-3.5 h-3.5 text-white/30" />
            </button>
          )}
        </div>
      </div>

      {/* Type filters */}
      <div className="flex gap-2 px-5 mb-5 overflow-x-auto no-scrollbar">
        {[
          { id: "all", label: `Todo (${notes.length})` },
          { id: "insight", label: `💡 ${typeCount("insight")}` },
          { id: "task",    label: `✅ ${typeCount("task")}` },
          { id: "text",    label: `📝 ${typeCount("text")}` },
          { id: "voice",   label: `🎤 ${typeCount("voice")}` },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTypeFilter(id)}
            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={{
              background: typeFilter === id ? `${color}20` : "rgba(255,255,255,0.05)",
              border: `1px solid ${typeFilter === id ? color + "50" : "transparent"}`,
              color: typeFilter === id ? color : "rgba(255,255,255,0.4)",
              touchAction: "manipulation",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Notes list */}
      {loading ? (
        <div className="flex justify-center py-20">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="w-8 h-8 rounded-full border-2 border-t-transparent"
            style={{ borderColor: `${color}40`, borderTopColor: color }}
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
            {query ? "Sin resultados" : "Sin notas todavía"}
          </p>
        </div>
      ) : (
        <div className="px-5 space-y-2">
          {filtered.map((n) => {
            const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.text;
            const Icon = cfg.icon;
            return (
              <div
                key={n.id}
                className="rounded-2xl p-4"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: `${cfg.color}20` }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm leading-relaxed">{n.content}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                        {TYPE_EMOJIS[n.sessionType] ?? "🌿"} {formatDate(n.sessionStartedAt)}
                        {n.minutesMark !== null && ` · min ${n.minutesMark}`}
                      </span>
                      {(n.tags ?? []).map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
