"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, ArrowUpRight, ArrowDownRight, ArrowLeftRight,
  Filter, Pencil, Trash2, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TransactionModal, AccountOption } from "./transaction-modal";
import { FinanceSubnav } from "./finance-dashboard";

// ── Types ─────────────────────────────────────────────────────────────────────

export type TransactionRow = {
  id: string;
  userId: string;
  accountId: string;
  toAccountId: string | null;
  businessId: string | null;
  clientId: string | null;
  projectId: string | null;
  type: "income" | "expense" | "transfer";
  amount: string;
  currency: string;
  exchangeRateMXN: string | null;
  category: string | null;
  description: string;
  date: string;
  status: "completed" | "pending" | "cancelled";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  accountName: string | null;
  accountIcon: string | null;
  clientName: string | null;
  projectName: string | null;
};

type ClientOption = { id: string; name: string };
type ProjectOption = { id: string; name: string };
type BusinessOption = { id: string; name: string; logo: string | null };

type StatsData = {
  income: Record<string, number>;
  expense: Record<string, number>;
};

// ── Config ────────────────────────────────────────────────────────────────────

const typeConfig = {
  income:   { label: "Ingreso",      icon: ArrowUpRight,   className: "text-emerald-600 bg-emerald-50",  amount: "text-emerald-600" },
  expense:  { label: "Egreso",        icon: ArrowDownRight, className: "text-red-500 bg-red-50",          amount: "text-red-500" },
  transfer: { label: "Transferencia", icon: ArrowLeftRight, className: "text-blue-600 bg-blue-50",        amount: "text-blue-600" },
};

const statusConfig = {
  completed: { label: "Completada", dot: "bg-emerald-400" },
  pending:   { label: "Pendiente",  dot: "bg-amber-400" },
  cancelled: { label: "Cancelada",  dot: "bg-slate-300" },
};

const currencySymbol: Record<string, string> = {
  MXN: "$", USD: "$", EUR: "€", BTC: "₿", ETH: "Ξ", USDT: "$", other: "",
};

function formatAmount(amount: string, currency: string, type: "income" | "expense" | "transfer") {
  const num = parseFloat(amount);
  const sym = currencySymbol[currency] ?? "";
  const prefix = type === "income" ? "+" : type === "expense" ? "−" : "";
  if (["BTC", "ETH"].includes(currency)) return `${prefix}${num.toFixed(6)} ${currency}`;
  return `${prefix}${sym}${num.toLocaleString("es-MX", { minimumFractionDigits: 2 })} ${currency}`;
}

// ── Period presets ─────────────────────────────────────────────────────────────

function getPresetDates(preset: string): { start: string; end: string } {
  const today = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (preset === "this_month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end   = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { start: fmt(start), end: fmt(end) };
  }
  if (preset === "last_month") {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end   = new Date(today.getFullYear(), today.getMonth(), 0);
    return { start: fmt(start), end: fmt(end) };
  }
  if (preset === "this_year") {
    return { start: `${today.getFullYear()}-01-01`, end: `${today.getFullYear()}-12-31` };
  }
  // all
  return { start: "", end: "" };
}

// ── Transaction Row ────────────────────────────────────────────────────────────

function TxRow({
  tx,
  onEdit,
  onDelete,
}: {
  tx: TransactionRow;
  onEdit: (t: TransactionRow) => void;
  onDelete: (id: string) => void;
}) {
  const cfg = typeConfig[tx.type];
  const Icon = cfg.icon;
  const statusCfg = statusConfig[tx.status];

  const dateStr = new Date(tx.date + "T12:00:00").toLocaleDateString("es-MX", {
    day: "2-digit", month: "short", year: "numeric",
  });

  return (
    <div className="group flex items-center gap-3 px-4 py-3 hover:bg-slate-50 rounded-xl transition-colors">
      {/* Icon */}
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", cfg.className)}>
        <Icon className="w-4 h-4" />
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">{tx.description}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-slate-400">{dateStr}</span>
          {tx.accountName && (
            <>
              <span className="text-slate-200 text-xs">·</span>
              <span className="text-xs text-slate-400">
                {tx.accountIcon || "💰"} {tx.accountName}
              </span>
            </>
          )}
          {tx.category && (
            <>
              <span className="text-slate-200 text-xs">·</span>
              <span className="text-xs text-slate-400">{tx.category}</span>
            </>
          )}
          {tx.clientName && (
            <>
              <span className="text-slate-200 text-xs">·</span>
              <span className="text-xs text-slate-400">{tx.clientName}</span>
            </>
          )}
        </div>
      </div>

      {/* Status dot */}
      {tx.status !== "completed" && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={cn("w-1.5 h-1.5 rounded-full", statusCfg.dot)} />
          <span className="text-xs text-slate-400 hidden sm:block">{statusCfg.label}</span>
        </div>
      )}

      {/* Amount */}
      <p className={cn("text-sm font-semibold tabular-nums flex-shrink-0", cfg.amount)}>
        {formatAmount(tx.amount, tx.currency, tx.type)}
      </p>

      {/* Actions */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          onClick={() => onEdit(tx)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onDelete(tx.id)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Stats Bar ─────────────────────────────────────────────────────────────────

function StatsBar({ stats }: { stats: StatsData }) {
  const currencies = [...new Set([...Object.keys(stats.income), ...Object.keys(stats.expense)])];

  if (currencies.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3">
      {currencies.map((cur) => {
        const inc = stats.income[cur] ?? 0;
        const exp = stats.expense[cur] ?? 0;
        const sym = currencySymbol[cur] ?? "";
        const fmt = (n: number) => {
          if (["BTC", "ETH"].includes(cur)) return `${n.toFixed(6)} ${cur}`;
          return `${sym}${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })} ${cur}`;
        };
        return (
          <div key={cur} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <p className="text-xs text-slate-400 mb-2">{cur}</p>
            <div className="flex justify-between gap-4">
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">Ingresos</p>
                <p className="text-base font-bold text-emerald-600 tabular-nums">{fmt(inc)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">Egresos</p>
                <p className="text-base font-bold text-red-500 tabular-nums">{fmt(exp)}</p>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-50">
              <p className="text-[10px] text-slate-400">Neto</p>
              <p className={cn("text-sm font-semibold tabular-nums", inc - exp >= 0 ? "text-slate-900" : "text-red-500")}>
                {inc - exp >= 0 ? "+" : "−"}{fmt(Math.abs(inc - exp))}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function TransactionsList({
  initialTransactions,
  initialStats,
  accounts,
  clients,
  projects,
  businesses,
  currentUserId,
}: {
  initialTransactions: TransactionRow[];
  initialStats: StatsData;
  accounts: AccountOption[];
  clients: ClientOption[];
  projects: ProjectOption[];
  businesses: BusinessOption[];
  currentUserId: string;
}) {
  const router = useRouter();

  const [txList, setTxList]           = useState(initialTransactions);
  const [stats, setStats]             = useState(initialStats);
  const [modal, setModal]             = useState<TransactionRow | null | undefined>(undefined);
  const [loading, setLoading]         = useState(false);

  // Filters
  const [period, setPeriod]           = useState("this_month");
  const [filterType, setFilterType]   = useState<string>("all");
  const [filterAccount, setFilterAccount] = useState("");
  const [filterStatus, setFilterStatus]   = useState("");
  const [showFilters, setShowFilters] = useState(false);

  async function fetchData(opts?: {
    p?: string; ft?: string; fa?: string; fs?: string;
  }) {
    setLoading(true);
    try {
      const p  = opts?.p  ?? period;
      const ft = opts?.ft ?? filterType;
      const fa = opts?.fa ?? filterAccount;
      const fs = opts?.fs ?? filterStatus;

      const { start, end } = getPresetDates(p);
      const params = new URLSearchParams({ limit: "100", offset: "0" });
      if (start) params.set("startDate", start);
      if (end)   params.set("endDate", end);
      if (ft && ft !== "all") params.set("type", ft);
      if (fa)    params.set("accountId", fa);
      if (fs)    params.set("status", fs);

      const statsParams = new URLSearchParams();
      if (start) statsParams.set("startDate", start);
      if (end)   statsParams.set("endDate", end);

      const [txRes, stRes] = await Promise.all([
        fetch(`/api/transactions?${params}`),
        fetch(`/api/transactions/stats?${statsParams}`),
      ]);
      if (txRes.ok)  setTxList(await txRes.json());
      if (stRes.ok)  setStats(await stRes.json());
    } finally {
      setLoading(false);
    }
  }

  function applyPeriod(p: string) {
    setPeriod(p);
    fetchData({ p });
  }

  function applyType(ft: string) {
    setFilterType(ft);
    fetchData({ ft });
  }

  function applyAccount(fa: string) {
    setFilterAccount(fa);
    fetchData({ fa });
  }

  function applyStatus(fs: string) {
    setFilterStatus(fs);
    fetchData({ fs });
  }

  function handleSaved() {
    setModal(undefined);
    fetchData();
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta transacción?")) return;
    await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    setTxList((prev) => prev.filter((t) => t.id !== id));
  }

  const periodLabels: Record<string, string> = {
    this_month: "Este mes",
    last_month: "Mes anterior",
    this_year:  "Este año",
    all:        "Todo",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transacciones</h1>
          <p className="text-sm text-slate-500 mt-0.5">{txList.length} registros</p>
        </div>
        <button
          onClick={() => setModal(null)}
          className="flex items-center gap-2 px-4 py-2 bg-[#1e3a5f] text-white rounded-xl text-sm font-medium hover:bg-[#162d4a] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva
        </button>
      </div>

      {/* Sub-nav */}
      <FinanceSubnav active="/finanzas/transacciones" />

      {/* Stats */}
      <StatsBar stats={stats} />

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Period */}
          <div className="flex gap-1 bg-slate-50 rounded-lg p-0.5">
            {Object.entries(periodLabels).map(([val, label]) => (
              <button
                key={val}
                onClick={() => applyPeriod(val)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  period === val ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Type filter */}
          <div className="flex gap-1 bg-slate-50 rounded-lg p-0.5">
            {[
              { val: "all",      label: "Todos" },
              { val: "income",   label: "Ingresos" },
              { val: "expense",  label: "Egresos" },
              { val: "transfer", label: "Transferencias" },
            ].map(({ val, label }) => (
              <button
                key={val}
                onClick={() => applyType(val)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  filterType === val ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* More filters toggle */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
              showFilters || filterAccount || filterStatus
                ? "border-[#1e3a5f]/30 text-[#1e3a5f] bg-[#1e3a5f]/5"
                : "border-slate-200 text-slate-500 hover:bg-slate-50"
            )}
          >
            <Filter className="w-3.5 h-3.5" />
            Filtros
            {(filterAccount || filterStatus) && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#1e3a5f]" />
            )}
          </button>

          {loading && (
            <span className="text-xs text-slate-400 animate-pulse">Cargando...</span>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-100">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Cuenta</label>
              <select
                value={filterAccount}
                onChange={(e) => applyAccount(e.target.value)}
                className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none"
              >
                <option value="">Todas</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.icon || "💰"} {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Estado</label>
              <select
                value={filterStatus}
                onChange={(e) => applyStatus(e.target.value)}
                className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none"
              >
                <option value="">Todos</option>
                <option value="completed">Completadas</option>
                <option value="pending">Pendientes</option>
                <option value="cancelled">Canceladas</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {txList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ArrowUpRight className="w-10 h-10 text-slate-200 mb-3" />
            <p className="text-slate-500 font-medium">Sin transacciones</p>
            <p className="text-slate-400 text-sm mt-1">
              Registra ingresos, egresos o transferencias entre cuentas
            </p>
            <button
              onClick={() => setModal(null)}
              className="mt-4 px-4 py-2 bg-[#1e3a5f] text-white rounded-xl text-sm font-medium hover:bg-[#162d4a] transition-colors"
            >
              Primera transacción
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-50 p-2">
            {txList.map((tx) => (
              <TxRow
                key={tx.id}
                tx={tx}
                onEdit={setModal}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal !== undefined && (
        <TransactionModal
          transaction={modal}
          accounts={accounts}
          clients={clients}
          projects={projects}
          businesses={businesses}
          onClose={() => setModal(undefined)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
