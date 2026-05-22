"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Leaf, Plus, Clock, TrendingUp, Star, Zap, FileText, History, BarChart2, BookOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { SessionStartModal } from "./session-start-modal";
import { SessionDetailModal } from "./session-detail-modal";

const THEMES = {
  green:  { accent: "#00c896", glow: "rgba(0,200,150,0.4)",  text: "#a8f5d1", bg: "#070e0a" },
  violet: { accent: "#9945ff", glow: "rgba(153,69,255,0.4)", text: "#d8b4fe", bg: "#06040d" },
};

function formatDuration(s: number) {
  if (!s) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

function formatDate(d: string | Date) {
  const date = new Date(d);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 86400000) {
    return `Hoy ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
  }
  if (diff < 172800000) return "Ayer";
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

const TYPE_EMOJIS: Record<string, string> = {
  sativa: "🌿", indica: "🌑", hybrid: "⚡", cbd: "🌸", hash: "🪨", concentrate: "💎",
};

const METHOD_LABELS: Record<string, string> = {
  joint: "Joint", pipe: "Pipe", vape: "Vape", edible: "Edible", bong: "Bong", dab: "Dab",
};

interface Session {
  id: string;
  type: string;
  method: string;
  amount: string;
  strain: string | null;
  startedAt: string;
  elapsedSeconds: number | null;
  overallRating: number | null;
  status: string;
  checkinCount?: number;
  noteCount?: number;
}

interface Stats {
  totalSessions: number;
  totalSeconds: number;
  avgRating: number;
  favoriteType: string | null;
}

interface Props {
  activeSession: Session | null;
  sessions: Session[];
  stats: Stats;
}

export function Dashboard420({ activeSession, sessions, stats }: Props) {
  const router = useRouter();
  const [themeKey, setThemeKey] = useState<"green" | "violet">("green");
  const [startOpen, setStartOpen] = useState(false);
  const [activeElapsed, setActiveElapsed] = useState(0);
  const [tab, setTab] = useState<"home" | "history" | "stats">("home");
  const [detailSessionId, setDetailSessionId] = useState<string | null>(null);

  const theme = THEMES[themeKey];

  useEffect(() => {
    const stored = localStorage.getItem("verde-420-mode");
    if (stored === "violet") setThemeKey("violet");
  }, []);

  function toggleTheme() {
    const next = themeKey === "green" ? "violet" : "green";
    setThemeKey(next);
    localStorage.setItem("verde-420-mode", next);
  }

  // Live timer for active session
  useEffect(() => {
    if (!activeSession) return;
    const startMs = new Date(activeSession.startedAt).getTime();
    const tick = () => setActiveElapsed(Math.floor((Date.now() - startMs) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeSession]);

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const totalHours = (stats.totalSeconds / 3600).toFixed(1);

  return (
    <div className="min-h-screen" style={{ background: theme.bg, color: "#e2e8f0" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-6 pb-4">
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <Leaf className="w-6 h-6" style={{ color: theme.accent }} />
          </motion.div>
          <h1 className="font-black text-xl text-white">Flow</h1>
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
          style={{
            background: `${theme.accent}20`,
            border: `1px solid ${theme.accent}50`,
            color: theme.accent,
          }}
        >
          {themeKey === "green" ? "🌿" : "🔮"} {themeKey === "green" ? "Verde" : "Cosmos"}
        </button>
      </div>

      {/* Active session banner */}
      {activeSession && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-5 mb-4 rounded-2xl p-4 cursor-pointer"
          style={{
            background: `${theme.accent}12`,
            border: `1px solid ${theme.accent}50`,
            boxShadow: `0 0 30px ${theme.accent}20`,
          }}
          onClick={() => router.push(`/420/session/${activeSession.id}`)}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-2 h-2 rounded-full"
                style={{ background: theme.accent }}
              />
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: theme.accent }}>
                Sesión activa
              </span>
            </div>
            <span className="font-mono font-black text-white">{formatElapsed(activeElapsed)}</span>
          </div>
          <p className="text-sm text-white/60 mb-3">
            {TYPE_EMOJIS[activeSession.type]} {activeSession.type} · {METHOD_LABELS[activeSession.method]}
            {activeSession.strain && ` · ${activeSession.strain}`}
          </p>
          <div className="flex items-center justify-center gap-2 py-2 rounded-xl font-bold text-sm"
            style={{ background: theme.accent, color: "#020a06" }}>
            Continuar →
          </div>
        </motion.div>
      )}

      {/* Tab bar */}
      <div className="flex px-5 gap-2 mb-5">
        {[
          { id: "home", label: "Inicio", icon: Leaf },
          { id: "history", label: "Historial", icon: History },
          { id: "stats", label: "Stats", icon: BarChart2 },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id as typeof tab)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all"
            style={{
              background: tab === id ? `${theme.accent}20` : "rgba(255,255,255,0.04)",
              color: tab === id ? theme.accent : "rgba(255,255,255,0.35)",
              border: `1px solid ${tab === id ? theme.accent + "50" : "transparent"}`,
            }}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Home */}
      {tab === "home" && (
        <div className="px-5 space-y-5 pb-24">
          {/* New session CTA */}
          {!activeSession && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setStartOpen(true)}
              className="w-full py-8 rounded-3xl flex flex-col items-center gap-3 font-bold text-lg relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${theme.accent}20 0%, ${theme.accent}08 100%)`,
                border: `2px solid ${theme.accent}40`,
                boxShadow: `0 0 40px ${theme.accent}15`,
                color: theme.accent,
              }}
            >
              {/* Animated background glow */}
              <motion.div
                animate={{ scale: [0.9, 1.1, 0.9], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 rounded-3xl"
                style={{ background: `radial-gradient(circle at 50% 50%, ${theme.accent}15 0%, transparent 70%)` }}
              />
              <span className="text-4xl relative z-10">🌿</span>
              <span className="relative z-10">Iniciar sesión</span>
            </motion.button>
          )}

          {/* Stats strip */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Sesiones", value: stats.totalSessions, icon: Leaf },
              { label: "Horas", value: totalHours, icon: Clock },
              { label: "Rating", value: stats.avgRating || "—", icon: Star },
              { label: "Favorita", value: stats.favoriteType ? TYPE_EMOJIS[stats.favoriteType] || stats.favoriteType : "—", icon: TrendingUp },
            ].map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className="rounded-2xl p-3 text-center"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <p className="font-black text-base text-white">{value}</p>
                <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{label}</p>
              </div>
            ))}
          </div>

          {/* Recent sessions */}
          {sessions.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>
                  Recientes
                </p>
                <button onClick={() => setTab("history")} className="text-xs" style={{ color: theme.accent }}>
                  Ver todas →
                </button>
              </div>
              <div className="space-y-2">
                {sessions.slice(0, 5).map((s) => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    accent={theme.accent}
                    onClick={() => setDetailSessionId(s.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {sessions.length === 0 && !activeSession && (
            <div className="text-center py-8">
              <p className="text-4xl mb-3">🌱</p>
              <p className="text-white font-semibold mb-1">Sin sesiones aún</p>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
                Inicia tu primera sesión para comenzar a trackear.
              </p>
            </div>
          )}

          {/* Quick links */}
          <button
            onClick={() => router.push("/420/notes")}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all active:scale-[0.98]"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              touchAction: "manipulation",
            }}
          >
            <BookOpen className="w-4 h-4 shrink-0" style={{ color: theme.accent }} />
            <span className="text-sm flex-1 text-left" style={{ color: "rgba(255,255,255,0.55)" }}>
              Todas las notas e insights
            </span>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>→</span>
          </button>
        </div>
      )}

      {/* Tab: History */}
      {tab === "history" && (
        <div className="px-5 space-y-3 pb-24">
          {sessions.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-white/50 text-sm">Sin historial todavía</p>
            </div>
          ) : (
            sessions.map((s) => (
              <SessionCard
                key={s.id}
                session={s}
                accent={theme.accent}
                onClick={() => setDetailSessionId(s.id)}
                expanded
              />
            ))
          )}
        </div>
      )}

      {/* Tab: Stats */}
      {tab === "stats" && (
        <div className="px-5 space-y-4 pb-24">
          {/* Dimension averages */}
          <div
            className="rounded-2xl p-5"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "rgba(255,255,255,0.35)" }}>
              Promedio por dimensión
            </p>
            <div className="space-y-3">
              {stats.totalSessions === 0 ? (
                <p className="text-center text-sm py-4" style={{ color: "rgba(255,255,255,0.3)" }}>
                  Necesitas cerrar al menos una sesión
                </p>
              ) : null}
            </div>
          </div>

          {/* Summary grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Total sesiones", value: stats.totalSessions },
              { label: "Tiempo total", value: formatDuration(stats.totalSeconds) },
              { label: "Rating promedio", value: stats.avgRating ? `${stats.avgRating}/10` : "—" },
              { label: "Tipo favorito", value: stats.favoriteType ? `${TYPE_EMOJIS[stats.favoriteType]} ${stats.favoriteType}` : "—" },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-2xl p-4"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <p className="text-white font-black text-lg">{value}</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FAB - start session */}
      {tab !== "home" && !activeSession && (
        <button
          onClick={() => setStartOpen(true)}
          className="fixed bottom-24 right-5 w-14 h-14 rounded-full flex items-center justify-center shadow-lg z-30 transition-all active:scale-95"
          style={{ background: theme.accent, boxShadow: `0 0 25px ${theme.accent}60` }}
        >
          <Plus className="w-6 h-6" style={{ color: "#020a06" }} />
        </button>
      )}

      <SessionStartModal
        open={startOpen}
        onClose={() => setStartOpen(false)}
        color={theme.accent}
      />

      <SessionDetailModal
        sessionId={detailSessionId}
        color={theme.accent}
        onClose={() => setDetailSessionId(null)}
        onDeleted={() => { setDetailSessionId(null); router.refresh(); }}
      />
    </div>
  );
}

// ─── Session Card ─────────────────────────────────────────────────────────────

interface SessionCardProps {
  session: Session;
  accent: string;
  onClick: () => void;
  expanded?: boolean;
}

function SessionCard({ session: s, accent, onClick, expanded = false }: SessionCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl p-4 transition-all active:scale-[0.98]"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0 flex-1">
          <p className="text-white font-bold text-sm truncate">
            {TYPE_EMOJIS[s.type]} {s.type}
            {s.strain && <span className="text-white/40 font-normal"> · {s.strain}</span>}
          </p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.38)" }}>
            {METHOD_LABELS[s.method]} · {formatDate(s.startedAt)} · {formatDuration(s.elapsedSeconds ?? 0)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {s.overallRating && (
            <div
              className="px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1"
              style={{ background: `${accent}20`, color: accent }}
            >
              <Star className="w-3 h-3" fill={accent} />
              {s.overallRating}
            </div>
          )}
          <span className="text-white/20 text-xs">›</span>
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
        {(s.checkinCount ?? 0) > 0 && (
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3" style={{ color: accent }} /> {s.checkinCount} check-in{s.checkinCount !== 1 ? "s" : ""}
          </span>
        )}
        {(s.noteCount ?? 0) > 0 && (
          <span className="flex items-center gap-1">
            <FileText className="w-3 h-3" style={{ color: accent }} /> {s.noteCount} nota{s.noteCount !== 1 ? "s" : ""}
          </span>
        )}
        {!(s.checkinCount) && !(s.noteCount) && (
          <span className="text-white/20">Sin notas · toca para ver</span>
        )}
      </div>
    </button>
  );
}
