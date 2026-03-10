"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, Square, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActiveTimerProps {
  className?: string;
}

interface TimerSession {
  id: string;
  taskId: string | null;
  projectId: string | null;
  description: string | null;
  elapsedSeconds: number;
  status: "running" | "paused" | "stopped";
  startedAt: string;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function ActiveTimer({ className }: ActiveTimerProps) {
  const [session, setSession] = useState<TimerSession | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const baseElapsedRef = useRef(0);
  const sessionStartRef = useRef<Date | null>(null);

  const fetchActive = useCallback(async () => {
    try {
      const res = await fetch("/api/time-sessions?active=1");
      const data = await res.json();
      if (data) {
        setSession(data);
        baseElapsedRef.current = data.elapsedSeconds;
        sessionStartRef.current = new Date(data.startedAt);
        // Calculate elapsed since startedAt if running
        if (data.status === "running") {
          const extraSeconds = Math.floor((Date.now() - new Date(data.startedAt).getTime()) / 1000);
          setElapsed(data.elapsedSeconds + extraSeconds);
        } else {
          setElapsed(data.elapsedSeconds);
        }
      } else {
        setSession(null);
        setElapsed(0);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchActive();
    // Listen for custom event when a new timer is started elsewhere
    const handler = () => fetchActive();
    window.addEventListener("timer:started", handler);
    return () => window.removeEventListener("timer:started", handler);
  }, [fetchActive]);

  useEffect(() => {
    if (session?.status === "running") {
      intervalRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [session?.status]);

  async function handlePause() {
    if (!session) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/time-sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pause", elapsedSeconds: elapsed }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSession(updated);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResume() {
    if (!session) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/time-sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resume", elapsedSeconds: elapsed }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSession(updated);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleStop() {
    if (!session) return;
    setLoading(true);
    try {
      await fetch(`/api/time-sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop", elapsedSeconds: elapsed }),
      });
      setSession(null);
      setElapsed(0);
    } finally {
      setLoading(false);
    }
  }

  if (!session) return null;

  const isRunning = session.status === "running";

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-mono",
      isRunning
        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
        : "bg-amber-50 border-amber-200 text-amber-800",
      className
    )}>
      <Timer className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="tabular-nums min-w-[52px]">{formatTime(elapsed)}</span>
      {session.description && (
        <span className="text-xs opacity-70 max-w-[120px] truncate hidden sm:block">
          {session.description}
        </span>
      )}
      <div className="flex items-center gap-1">
        <button
          onClick={isRunning ? handlePause : handleResume}
          disabled={loading}
          className="p-1 rounded hover:bg-black/5 transition-colors"
          title={isRunning ? "Pausar" : "Reanudar"}
        >
          {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={handleStop}
          disabled={loading}
          className="p-1 rounded hover:bg-black/5 transition-colors"
          title="Detener"
        >
          <Square className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// Utility to start a new timer from anywhere
export async function startTimer(options: {
  taskId?: string | null;
  projectId?: string | null;
  description?: string | null;
}): Promise<boolean> {
  try {
    const res = await fetch("/api/time-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options),
    });
    if (res.ok) {
      window.dispatchEvent(new Event("timer:started"));
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}
