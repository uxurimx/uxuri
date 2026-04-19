"use client";

import { useState, useTransition } from "react";
import {
  RefreshCw, Server, Wifi, WifiOff, StopCircle, Smartphone,
  Plus, X, CheckCircle2, AlertCircle, Loader2, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface WaAccount {
  name: string;
  path: string;
  hasSession: boolean;
  inUse: boolean;
  jobId: string | null;
}

interface Job {
  jobId: string;
  campaignId: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  session: string | null;
}

interface ServerStatus {
  connected: boolean;
  error?: string;
  workerId?: string;
  hostname?: string;
  headless?: boolean;
  jobs?: Job[];
  accounts?: WaAccount[];
}

interface DbWorker {
  id: string;
  workerId: string;
  hostname: string | null;
  workerType: string | null;
  status: string;
  lastHeartbeat: string | null;
  currentCampaignId: string | null;
  capabilities: string[] | null;
}

interface WorkersPanelProps {
  initialStatus: ServerStatus;
  dbWorkers: DbWorker[];
}

// ── Componente ────────────────────────────────────────────────────────────────

export function WorkersPanel({ initialStatus, dbWorkers }: WorkersPanelProps) {
  const [status, setStatus]         = useState<ServerStatus>(initialStatus);
  const [showAddPhone, setShowAddPhone] = useState(false);
  const [phone, setPhone]           = useState("");
  const [loginMsg, setLoginMsg]     = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function refresh() {
    startTransition(async () => {
      const res = await fetch("/api/mkt/server/status", { cache: "no-store" });
      if (res.ok) setStatus(await res.json());
    });
  }

  async function stopJob(jobId: string) {
    const res = await fetch(`/api/mkt/jobs/${jobId}/stop`, { method: "POST" });
    if (res.ok) {
      setStatus((prev) => ({
        ...prev,
        jobs: prev.jobs?.map((j) =>
          j.jobId === jobId ? { ...j, status: "stopped" } : j
        ),
      }));
    }
  }

  async function addAccount() {
    if (!phone.trim()) return;
    setLoginMsg(null);
    const res = await fetch("/api/mkt/whatsapp/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phone.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      setLoginMsg(data.message ?? "Chromium abierto — escanea el QR.");
      setPhone("");
      setShowAddPhone(false);
      setTimeout(refresh, 5000);
    } else {
      setLoginMsg(`Error: ${data.error}`);
    }
  }

  const activeJobs  = status.jobs?.filter((j) => j.status === "running") ?? [];
  const finishedJobs = status.jobs?.filter((j) => j.status !== "running") ?? [];

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#1e3a5f]/10 flex items-center justify-center">
            <Server className="w-5 h-5 text-[#1e3a5f]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Infraestructura</h1>
            <p className="text-sm text-slate-500">mkt-server · Workers · Cuentas WhatsApp</p>
          </div>
        </div>
        <button
          onClick={refresh}
          disabled={isPending}
          className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={cn("w-4 h-4", isPending && "animate-spin")} />
          Actualizar
        </button>
      </div>

      {/* ── mkt-server status ── */}
      <section>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          mkt-server
        </h2>
        <div className={cn(
          "rounded-xl border p-4 flex items-start gap-4",
          status.connected
            ? "bg-emerald-50 border-emerald-200"
            : "bg-red-50 border-red-200"
        )}>
          <div className={cn(
            "p-2 rounded-lg shrink-0",
            status.connected ? "bg-emerald-100" : "bg-red-100"
          )}>
            {status.connected
              ? <Wifi className="w-5 h-5 text-emerald-700" />
              : <WifiOff className="w-5 h-5 text-red-700" />
            }
          </div>
          <div className="flex-1 min-w-0">
            {status.connected ? (
              <>
                <p className="font-semibold text-emerald-800 text-sm">Conectado</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-emerald-700">
                  <span>ID: <code className="bg-emerald-100 px-1 rounded">{status.workerId}</code></span>
                  {status.hostname && <span>Host: <code className="bg-emerald-100 px-1 rounded">{status.hostname}</code></span>}
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-full font-medium",
                    status.headless ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                  )}>
                    {status.headless ? "headless (sin display)" : "con display / Xvfb"}
                  </span>
                </div>
                <p className="text-xs text-emerald-600 mt-1">
                  {process.env.NEXT_PUBLIC_MKT_SERVER_URL
                    ? `URL: ${process.env.NEXT_PUBLIC_MKT_SERVER_URL}`
                    : "Configura NEXT_PUBLIC_MKT_SERVER_URL para mostrar la URL"}
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold text-red-800 text-sm">Sin conexión</p>
                <p className="text-xs text-red-700 mt-0.5">{status.error}</p>
                <p className="text-xs text-red-600 mt-2 font-mono bg-red-100 inline-block px-2 py-0.5 rounded">
                  python server.py
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── Jobs activos ── */}
      {status.connected && (
        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Jobs en ejecución {activeJobs.length > 0 && `(${activeJobs.length})`}
          </h2>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {activeJobs.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <Clock className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">Sin jobs corriendo ahora</p>
                <p className="text-slate-300 text-xs mt-1">Lanza una campaña desde la sección Campañas</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {activeJobs.map((job) => (
                  <li key={job.jobId} className="flex items-center gap-3 px-4 py-3">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {job.campaignId.slice(0, 8)}…
                      </p>
                      <p className="text-xs text-slate-500">
                        {job.status} · sesión: {job.session ?? "default"} · iniciado{" "}
                        {new Date(job.startedAt).toLocaleTimeString("es-MX")}
                      </p>
                    </div>
                    <StatusBadge status={job.status} />
                    <button
                      onClick={() => stopJob(job.jobId)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <StopCircle className="w-3.5 h-3.5" />
                      Detener
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Jobs terminados (colapsados) */}
          {finishedJobs.length > 0 && (
            <details className="mt-2">
              <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600 select-none px-1">
                {finishedJobs.length} job(s) anteriores
              </summary>
              <ul className="mt-2 space-y-1">
                {finishedJobs.slice(0, 10).map((job) => (
                  <li key={job.jobId} className="flex items-center gap-3 px-4 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs">
                    <span className="text-slate-400 font-mono">{job.jobId.slice(0, 8)}</span>
                    <span className="text-slate-500 truncate flex-1">{job.campaignId.slice(0, 8)}…</span>
                    <StatusBadge status={job.status} />
                    {job.finishedAt && (
                      <span className="text-slate-400">
                        {new Date(job.finishedAt).toLocaleTimeString("es-MX")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}

      {/* ── Cuentas WhatsApp ── */}
      {status.connected && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Cuentas WhatsApp
            </h2>
            <button
              onClick={() => { setShowAddPhone((v) => !v); setLoginMsg(null); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e3a5f] text-white rounded-lg text-xs font-medium hover:bg-[#162d4a] transition-colors"
            >
              {showAddPhone ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {showAddPhone ? "Cancelar" : "Agregar número"}
            </button>
          </div>

          {/* Form agregar número */}
          {showAddPhone && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              {status.headless && (
                <p className="text-xs text-amber-700 mb-3 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  El servidor está en modo headless (sin display). Para escanear el QR necesitas
                  conectarte via VNC o usar un servidor con pantalla.
                </p>
              )}
              <p className="text-xs text-amber-800 mb-3">
                Ingresa el número con código de país. Chromium se abrirá con WhatsApp Web para escanear el QR.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+52618xxxxxxx"
                  className="flex-1 border border-amber-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/30 bg-white"
                  onKeyDown={(e) => e.key === "Enter" && addAccount()}
                />
                <button
                  onClick={addAccount}
                  disabled={!phone.trim()}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
                >
                  Iniciar login
                </button>
              </div>
              {loginMsg && (
                <p className={cn(
                  "text-xs mt-2",
                  loginMsg.startsWith("Error") ? "text-red-600" : "text-emerald-700"
                )}>
                  {loginMsg}
                </p>
              )}
            </div>
          )}

          {/* Grid de cuentas */}
          {(status.accounts?.length ?? 0) === 0 ? (
            <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl">
              <Smartphone className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">Sin sesiones WA guardadas</p>
              <p className="text-slate-300 text-xs mt-1">Agrega un número para empezar</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {status.accounts!.map((acc) => (
                <AccountCard key={acc.name} account={acc} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Workers en DB ── */}
      <section>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Workers registrados
        </h2>
        {dbWorkers.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-sm">
            Ningún worker ha enviado heartbeat todavía
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
                  <th className="text-left px-4 py-2.5 font-medium">Worker</th>
                  <th className="text-left px-4 py-2.5 font-medium">Tipo</th>
                  <th className="text-left px-4 py-2.5 font-medium">Estado</th>
                  <th className="text-left px-4 py-2.5 font-medium">Último heartbeat</th>
                  <th className="text-left px-4 py-2.5 font-medium">Capacidades</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {dbWorkers.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{w.hostname ?? w.workerId}</p>
                      <p className="text-xs text-slate-400 font-mono">{w.workerId}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{w.workerType ?? "—"}</td>
                    <td className="px-4 py-3">
                      <WorkerStatusBadge status={w.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {w.lastHeartbeat
                        ? new Date(w.lastHeartbeat).toLocaleString("es-MX", {
                            day: "numeric", month: "short",
                            hour: "2-digit", minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(w.capabilities ?? []).map((cap) => (
                          <span key={cap} className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            {cap}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </div>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function AccountCard({ account }: { account: WaAccount }) {
  const { name, hasSession, inUse, jobId } = account;
  return (
    <div className={cn(
      "border rounded-xl p-3 flex flex-col gap-2",
      inUse   ? "border-amber-300 bg-amber-50"
      : hasSession ? "border-emerald-200 bg-emerald-50"
      : "border-slate-200 bg-slate-50"
    )}>
      <div className="flex items-center gap-2">
        <Smartphone className={cn(
          "w-4 h-4 shrink-0",
          inUse ? "text-amber-600" : hasSession ? "text-emerald-600" : "text-slate-400"
        )} />
        <span className="text-xs font-medium text-slate-700 truncate">{name}</span>
      </div>
      {inUse ? (
        <span className="inline-flex items-center gap-1 text-xs text-amber-700 font-medium">
          <Loader2 className="w-3 h-3 animate-spin" />
          En uso
        </span>
      ) : hasSession ? (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
          <CheckCircle2 className="w-3 h-3" />
          Lista
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
          <AlertCircle className="w-3 h-3" />
          Sin sesión
        </span>
      )}
      {inUse && jobId && (
        <p className="text-[10px] text-amber-600 font-mono truncate">job: {jobId}</p>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    running:  "bg-emerald-100 text-emerald-700",
    pending:  "bg-amber-100 text-amber-700",
    done:     "bg-blue-100 text-blue-700",
    stopped:  "bg-slate-100 text-slate-600",
    error:    "bg-red-100 text-red-700",
  };
  return (
    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", map[status] ?? "bg-slate-100 text-slate-600")}>
      {status}
    </span>
  );
}

function WorkerStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium",
      status === "online"  ? "bg-emerald-100 text-emerald-700" :
      status === "busy"    ? "bg-amber-100 text-amber-700" :
                             "bg-slate-100 text-slate-500"
    )}>
      {status === "online" && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />}
      {status}
    </span>
  );
}
