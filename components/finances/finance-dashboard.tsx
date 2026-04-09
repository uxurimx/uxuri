"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus, ArrowUpRight, ArrowDownRight, ArrowLeftRight,
  Wallet, TrendingUp, TrendingDown, Minus, AlertCircle, Clock,
  CalendarDays, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export type DashboardAccount = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  currency: string;
  businessId: string | null;
  computedBalance: number;
};

export type MonthlyFlow = {
  month: string; // "2026-01"
  income: number;
  expense: number;
};

export type UpcomingBill = {
  id: string;
  name: string;
  amount: string;
  currency: string;
  nextDueDate: string;
  category: string | null;
};

export type RecentTx = {
  id: string;
  type: "income" | "expense" | "transfer";
  amount: string;
  currency: string;
  description: string;
  date: string;
  accountName: string | null;
  accountIcon: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const currencySymbol: Record<string, string> = {
  MXN: "$", USD: "$", EUR: "€", BTC: "₿", ETH: "Ξ", USDT: "$", other: "",
};

function fmt(amount: number | string, currency: string, compact = false): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  const sym = currencySymbol[currency] ?? "";
  if (["BTC", "ETH"].includes(currency)) return `${num.toFixed(4)} ${currency}`;
  if (compact && Math.abs(num) >= 1000) {
    return `${sym}${(num / 1000).toLocaleString("es-MX", { maximumFractionDigits: 1 })}k ${currency}`;
  }
  return `${sym}${num.toLocaleString("es-MX", { minimumFractionDigits: 2 })} ${currency}`;
}

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + "T12:00:00");
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return months[parseInt(m) - 1] ?? m;
}

// ── Sub-nav (shared across all finance pages) ──────────────────────────────────

export const FINANCE_SUBNAV = [
  { href: "/finanzas",               label: "Resumen" },
  { href: "/finanzas/cuentas",       label: "Cuentas" },
  { href: "/finanzas/transacciones", label: "Transacciones" },
  { href: "/finanzas/pagos",         label: "Pagos" },
  { href: "/finanzas/presupuesto",   label: "Presupuesto" },
];

export function FinanceSubnav({ active }: { active: string }) {
  const router = useRouter();
  return (
    <div className="flex gap-1 bg-slate-50 rounded-xl p-1 w-fit overflow-x-auto">
      {FINANCE_SUBNAV.map((item) => (
        <button
          key={item.href}
          onClick={() => router.push(item.href)}
          className={cn(
            "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
            item.href === active
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

// ── Cash Flow Chart ────────────────────────────────────────────────────────────

function CashFlowChart({ data }: { data: MonthlyFlow[] }) {
  const maxVal = Math.max(...data.flatMap((d) => [d.income, d.expense]), 1);
  const CHART_H = 100;
  const BAR_W   = 16;
  const GAP     = 4;
  const GROUP_W = BAR_W * 2 + GAP + 12;
  const totalW  = data.length * GROUP_W;

  if (data.every((d) => d.income === 0 && d.expense === 0)) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-300 text-sm">
        Sin datos aún
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${totalW} ${CHART_H + 28}`}
        className="w-full"
        style={{ minWidth: `${Math.max(totalW, 200)}px`, maxHeight: "140px" }}
      >
        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map((pct) => (
          <line
            key={pct}
            x1={0} y1={CHART_H * (1 - pct)}
            x2={totalW} y2={CHART_H * (1 - pct)}
            stroke="#f1f5f9" strokeWidth={1}
          />
        ))}

        {data.map((d, i) => {
          const x = i * GROUP_W;
          const incH = Math.max((d.income / maxVal) * CHART_H, d.income > 0 ? 2 : 0);
          const expH = Math.max((d.expense / maxVal) * CHART_H, d.expense > 0 ? 2 : 0);

          return (
            <g key={d.month}>
              {/* Income bar */}
              <rect
                x={x} y={CHART_H - incH}
                width={BAR_W} height={incH}
                fill="#10b981" rx={3}
                opacity={0.85}
              />
              {/* Expense bar */}
              <rect
                x={x + BAR_W + GAP} y={CHART_H - expH}
                width={BAR_W} height={expH}
                fill="#ef4444" rx={3}
                opacity={0.85}
              />
              {/* Month label */}
              <text
                x={x + BAR_W} y={CHART_H + 18}
                textAnchor="middle" fontSize={9}
                fill="#94a3b8"
              >
                {monthLabel(d.month)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex gap-4 mt-1 justify-end">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-emerald-500" />
          <span className="text-[10px] text-slate-400">Ingresos</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-red-500" />
          <span className="text-[10px] text-slate-400">Egresos</span>
        </div>
      </div>
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, trend, trendUp, color = "slate",
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: string;
  trendUp?: boolean;
  color?: "slate" | "emerald" | "red" | "blue";
}) {
  const colors = {
    slate:   "text-slate-900",
    emerald: "text-emerald-600",
    red:     "text-red-500",
    blue:    "text-blue-600",
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-1">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={cn("text-xl font-bold tabular-nums leading-tight", colors[color])}>{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
      {trend && (
        <div className={cn("flex items-center gap-1 text-xs font-medium", trendUp ? "text-emerald-600" : "text-red-500")}>
          {trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {trend}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function FinanceDashboard({
  accounts,
  monthStats,
  cashFlow,
  upcomingBills,
  recentTx,
}: {
  accounts: DashboardAccount[];
  monthStats: { income: Record<string, number>; expense: Record<string, number> };
  cashFlow: MonthlyFlow[];
  upcomingBills: UpcomingBill[];
  recentTx: RecentTx[];
}) {
  const router = useRouter();

  // ── KPI computations ─────────────────────────────────────────────────────────

  // Total balance by currency
  const totalBalance: Record<string, number> = {};
  for (const acc of accounts) {
    if (acc.computedBalance !== 0 || true) {
      totalBalance[acc.currency] = (totalBalance[acc.currency] ?? 0) + acc.computedBalance;
    }
  }

  // This month primary currency (MXN or first with data)
  const primaryCurrency = Object.keys(monthStats.income)[0]
    ?? Object.keys(monthStats.expense)[0]
    ?? "MXN";

  const monthIncome  = monthStats.income[primaryCurrency]  ?? 0;
  const monthExpense = monthStats.expense[primaryCurrency] ?? 0;
  const monthNet     = monthIncome - monthExpense;

  // Next bill due
  const nextBill = upcomingBills[0];
  const nextDays  = nextBill ? daysUntil(nextBill.nextDueDate) : null;

  // ── Account grouping ──────────────────────────────────────────────────────────

  const personal  = accounts.filter((a) => !a.businessId);
  const business  = accounts.filter((a) =>  a.businessId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Finanzas</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {new Date().toLocaleDateString("es-MX", { month: "long", year: "numeric" })}
          </p>
        </div>
        <button
          onClick={() => router.push("/finanzas/transacciones")}
          className="flex items-center gap-2 px-4 py-2 bg-[#1e3a5f] text-white rounded-xl text-sm font-medium hover:bg-[#162d4a] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva transacción
        </button>
      </div>

      {/* Sub-nav */}
      <FinanceSubnav active="/finanzas" />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Balance total (primary currency) */}
        {Object.entries(totalBalance)
          .filter(([, v]) => v !== 0)
          .slice(0, 2)
          .map(([cur, total]) => (
            <KpiCard
              key={cur}
              label={`Saldo total ${cur}`}
              value={fmt(total, cur, true)}
              color={total >= 0 ? "slate" : "red"}
            />
          ))}

        {/* Month income */}
        <KpiCard
          label="Ingresos del mes"
          value={monthIncome > 0 ? fmt(monthIncome, primaryCurrency, true) : "—"}
          color="emerald"
        />

        {/* Month expense */}
        <KpiCard
          label="Egresos del mes"
          value={monthExpense > 0 ? fmt(monthExpense, primaryCurrency, true) : "—"}
          color="red"
        />

        {/* Net */}
        <KpiCard
          label="Neto del mes"
          value={monthIncome || monthExpense ? fmt(monthNet, primaryCurrency, true) : "—"}
          color={monthNet >= 0 ? "emerald" : "red"}
          sub={primaryCurrency}
        />
      </div>

      {/* Main content: Chart + Upcoming bills */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Cash flow chart */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-slate-900">Flujo de efectivo</h2>
              <p className="text-xs text-slate-400">Últimos 6 meses · {primaryCurrency}</p>
            </div>
          </div>
          <CashFlowChart data={cashFlow} />
        </div>

        {/* Upcoming bills */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Próximos vencimientos</h2>
            <Link
              href="/finanzas/pagos"
              className="text-xs text-[#1e3a5f] hover:underline"
            >
              Ver todos
            </Link>
          </div>

          {upcomingBills.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CalendarDays className="w-8 h-8 text-slate-200 mb-2" />
              <p className="text-sm text-slate-400">Sin vencimientos próximos</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingBills.map((bill) => {
                const days = daysUntil(bill.nextDueDate);
                const isOverdue = days < 0;
                const isSoon    = days >= 0 && days <= 3;
                return (
                  <div
                    key={bill.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border",
                      isOverdue ? "border-red-100 bg-red-50"
                        : isSoon  ? "border-amber-100 bg-amber-50"
                        : "border-slate-50 bg-slate-50"
                    )}
                  >
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full flex-shrink-0",
                      isOverdue ? "bg-red-500" : isSoon ? "bg-amber-400" : "bg-emerald-400"
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{bill.name}</p>
                      <p className={cn(
                        "text-xs",
                        isOverdue ? "text-red-500" : isSoon ? "text-amber-600" : "text-slate-400"
                      )}>
                        {isOverdue ? `Vencido hace ${Math.abs(days)}d` : days === 0 ? "Vence hoy" : `En ${days}d`}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 tabular-nums flex-shrink-0">
                      {fmt(bill.amount, bill.currency, true)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Accounts + Recent transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compact accounts */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Cuentas</h2>
            <Link
              href="/finanzas/cuentas"
              className="text-xs text-[#1e3a5f] hover:underline flex items-center gap-1"
            >
              Gestionar <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {accounts.length === 0 ? (
            <div className="text-center py-8">
              <Wallet className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Sin cuentas</p>
              <Link href="/finanzas/cuentas" className="text-xs text-[#1e3a5f] hover:underline mt-1 block">
                Agregar cuenta
              </Link>
            </div>
          ) : (
            <div className="space-y-1">
              {personal.length > 0 && (
                <>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-2">Personal</p>
                  {personal.map((acc) => (
                    <AccountRow key={acc.id} acc={acc} />
                  ))}
                </>
              )}
              {business.length > 0 && (
                <>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-2 mt-3">Negocios</p>
                  {business.map((acc) => (
                    <AccountRow key={acc.id} acc={acc} />
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Recent transactions */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Movimientos recientes</h2>
            <Link
              href="/finanzas/transacciones"
              className="text-xs text-[#1e3a5f] hover:underline flex items-center gap-1"
            >
              Ver todos <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {recentTx.length === 0 ? (
            <div className="text-center py-8">
              <ArrowUpRight className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Sin transacciones</p>
              <Link href="/finanzas/transacciones" className="text-xs text-[#1e3a5f] hover:underline mt-1 block">
                Registrar movimiento
              </Link>
            </div>
          ) : (
            <div className="space-y-1">
              {recentTx.map((tx) => {
                const typeConfig = {
                  income:   { Icon: ArrowUpRight,    cls: "text-emerald-600 bg-emerald-50", amount: "text-emerald-600", prefix: "+" },
                  expense:  { Icon: ArrowDownRight,  cls: "text-red-500 bg-red-50",         amount: "text-red-500",     prefix: "−" },
                  transfer: { Icon: ArrowLeftRight,  cls: "text-blue-600 bg-blue-50",       amount: "text-blue-600",    prefix: "" },
                }[tx.type];
                const { Icon, cls, amount: amtCls, prefix } = typeConfig;
                const dateStr = new Date(tx.date + "T12:00:00").toLocaleDateString("es-MX", {
                  day: "numeric", month: "short",
                });
                return (
                  <div key={tx.id} className="flex items-center gap-3 py-2">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", cls)}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900 truncate">{tx.description}</p>
                      <p className="text-xs text-slate-400">
                        {dateStr} · {tx.accountIcon || "💰"} {tx.accountName}
                      </p>
                    </div>
                    <p className={cn("text-sm font-semibold tabular-nums flex-shrink-0", amtCls)}>
                      {prefix}{fmt(tx.amount, tx.currency, true)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── AccountRow (compact) ──────────────────────────────────────────────────────

function AccountRow({ acc }: { acc: DashboardAccount }) {
  const color = acc.color || "#1e3a5f";
  const isNeg = acc.computedBalance < 0;
  return (
    <div className="flex items-center gap-3 py-2">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
        style={{ backgroundColor: color + "22" }}
      >
        {acc.icon || "💰"}
      </div>
      <p className="flex-1 text-sm text-slate-700 truncate">{acc.name}</p>
      <p className={cn("text-sm font-semibold tabular-nums flex-shrink-0", isNeg ? "text-red-500" : "text-slate-900")}>
        {fmt(acc.computedBalance, acc.currency, true)}
      </p>
    </div>
  );
}
