"use client";

import { useState, useEffect, useCallback } from "react";
import { Database, CloudUpload, CloudDownload, RefreshCw, CheckCircle, AlertCircle, Clock, ArrowLeftRight } from "lucide-react";

interface BackupStatus {
  lastBackup: string | null;
  lastDirection: "push" | "pull" | "merge" | null;
  schedule: "manual" | "hourly" | "daily" | "weekly";
  scheduleDirection: "push" | "pull";
  isLocal: boolean;
  isRunning: boolean;
  available: boolean;
}

const SCHEDULE_LABELS: Record<string, string> = {
  manual:  "Manual (solo botón)",
  hourly:  "Cada hora",
  daily:   "Diario",
  weekly:  "Semanal",
};

const DIRECTION_LABEL: Record<string, string> = {
  push:  "↑ local→Neon",
  pull:  "↓ Neon→local",
  merge: "⇄ merge",
};

function formatRelative(iso: string | null): string {
  if (!iso) return "Nunca";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return "Hace un momento";
  if (m < 60)  return `Hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `Hace ${h}h`;
  return `Hace ${Math.floor(h / 24)}d`;
}

export function BackupSettings() {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    const res = await fetch("/api/admin/backup").catch(() => null);
    if (res?.ok) setStatus(await res.json());
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 10_000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  async function runAction(action: "push" | "pull" | "merge") {
    setRunning(true);
    setResult(null);
    const res = await fetch("/api/admin/backup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    setRunning(false);
    const msgs: Record<string, string> = {
      push:  "Local sincronizado a Neon (sobreescritura)",
      pull:  "Neon sincronizado a local (sobreescritura)",
      merge: "Merge completado: local y Neon están sincronizados",
    };
    setResult(data.ok
      ? { ok: true,  msg: msgs[action] }
      : { ok: false, msg: data.error ?? "Error desconocido" }
    );
    fetchStatus();
  }

  async function saveConfig(patch: Partial<Pick<BackupStatus, "schedule" | "scheduleDirection">>) {
    await fetch("/api/admin/backup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    fetchStatus();
  }

  if (!status) {
    return <div className="bg-white border border-slate-200 rounded-xl p-5 animate-pulse h-40" />;
  }

  if (!status.available) {
    return (
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2">
          <Database className="w-4 h-4" /> Respaldo de base de datos
        </h2>
        <p className="text-sm text-slate-500 mt-2">
          Los respaldos manuales solo están disponibles en el entorno de desarrollo local.
        </p>
      </section>
    );
  }

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2">
          <Database className="w-4 h-4" /> Respaldo de base de datos
        </h2>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          status.isLocal
            ? "bg-amber-50 text-amber-700 border border-amber-200"
            : "bg-blue-50 text-blue-700 border border-blue-200"
        }`}>
          {status.isLocal ? "🏠 Local activo" : "☁️ Neon activo"}
        </span>
      </div>

      {/* Último respaldo */}
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Clock className="w-3.5 h-3.5 text-slate-400" />
        <span>
          Último respaldo: <strong>{formatRelative(status.lastBackup)}</strong>
          {status.lastBackup && (
            <span className="text-slate-400 ml-1">
              ({new Date(status.lastBackup).toLocaleString("es-MX")})
            </span>
          )}
          {status.lastDirection && (
            <span className="text-slate-400 ml-1">· {DIRECTION_LABEL[status.lastDirection]}</span>
          )}
        </span>
      </div>

      {/* Botón principal: Merge */}
      <button
        onClick={() => runAction("merge")}
        disabled={running}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1e3a5f] text-white text-sm font-medium rounded-lg hover:bg-[#162d4a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />}
        Merge bidireccional (recomendado)
      </button>

      {/* Botones manuales destructivos */}
      <details className="group">
        <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600 select-none">
          Sincronización manual (destructiva, avanzado)
        </summary>
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => runAction("push")}
            disabled={running}
            title="Sobreescribe Neon con tu local. Perderás datos de producción no presentes en local."
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {running ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CloudUpload className="w-3.5 h-3.5" />}
            Local → Neon (sobreescribir)
          </button>
          <button
            onClick={() => runAction("pull")}
            disabled={running}
            title="Sobreescribe local con Neon. Perderás datos locales no presentes en Neon."
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {running ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CloudDownload className="w-3.5 h-3.5" />}
            Neon → Local (sobreescribir)
          </button>
        </div>
        <p className="text-xs text-amber-600 mt-1.5">
          ⚠️ Los botones de arriba sobreescriben el destino completamente. Úsalos solo si sabes que no hay datos relevantes en el otro lado.
        </p>
      </details>

      {/* Resultado */}
      {result && (
        <div className={`flex items-start gap-2 text-sm p-3 rounded-lg ${
          result.ok
            ? "bg-green-50 text-green-700 border border-green-200"
            : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {result.ok
            ? <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          }
          <span>{result.msg}</span>
        </div>
      )}
    </section>
  );
}
