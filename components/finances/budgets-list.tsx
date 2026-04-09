"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Pencil, Trash2, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { FinanceSubnav } from "./finance-dashboard";

// ── Types ─────────────────────────────────────────────────────────────────────

export type BudgetRow = {
  id: string;
  userId: string;
  businessId: string | null;
  category: string;
  limitAmount: string;
  currency: string;
  period: "weekly" | "monthly" | "yearly";
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // computed on server
  spent: number;
};

type BusinessOption = { id: string; name: string; logo: string | null };

// ── Config ────────────────────────────────────────────────────────────────────

export const BUDGET_CATEGORIES = [
  { label: "Renta / Hipoteca",          emoji: "🏠" },
  { label: "Internet",                   emoji: "🌐" },
  { label: "Gas / Servicios",            emoji: "⚡" },
  { label: "Luz",                        emoji: "💡" },
  { label: "Agua",                       emoji: "💧" },
  { label: "Escuela",                    emoji: "📚" },
  { label: "Alimentación",               emoji: "🍽️" },
  { label: "Transporte",                 emoji: "🚗" },
  { label: "Marketing",                  emoji: "📣" },
  { label: "Software/Suscripciones",     emoji: "💻" },
  { label: "Sueldos",                    emoji: "👥" },
  { label: "Impuestos",                  emoji: "📋" },
  { label: "Seguro",                     emoji: "🛡️" },
  { label: "Streaming",                  emoji: "📺" },
  { label: "Gym / Salud",               emoji: "💪" },
  { label: "Ropa / Personal",            emoji: "👕" },
  { label: "Entretenimiento",            emoji: "🎭" },
  { label: "Viajes",                     emoji: "✈️" },
  { label: "Otro",                       emoji: "💰" },
];

function getCategoryEmoji(category: string): string {
  return BUDGET_CATEGORIES.find((c) => c.label === category)?.emoji ?? "💰";
}

const PERIOD_LABELS: Record<BudgetRow["period"], string> = {
  weekly:  "Semanal",
  monthly: "Mensual",
  yearly:  "Anual",
};

const currencySymbol: Record<string, string> = {
  MXN: "$", USD: "$", EUR: "€", BTC: "₿", ETH: "Ξ", USDT: "$", other: "",
};

function fmt(n: number, currency: string): string {
  const sym = currencySymbol[currency] ?? "";
  if (["BTC", "ETH"].includes(currency)) return `${n.toFixed(4)} ${currency}`;
  return `${sym}${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })} ${currency}`;
}

// ── Progress helpers ──────────────────────────────────────────────────────────

function pct(spent: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min((spent / limit) * 100, 100);
}

function statusConfig(p: number) {
  if (p >= 100) return { color: "bg-red-500",    text: "text-red-600",    label: "Superado",    Icon: AlertTriangle };
  if (p >= 80)  return { color: "bg-amber-400",  text: "text-amber-600",  label: "Al límite",   Icon: AlertTriangle };
  if (p >= 60)  return { color: "bg-yellow-400", text: "text-yellow-600", label: "Cuidado",     Icon: TrendingUp };
  return               { color: "bg-emerald-500", text: "text-emerald-600", label: "OK",         Icon: CheckCircle };
}

// ── Budget Card ───────────────────────────────────────────────────────────────

function BudgetCard({
  budget,
  onEdit,
  onDelete,
}: {
  budget: BudgetRow;
  onEdit: (b: BudgetRow) => void;
  onDelete: (id: string) => void;
}) {
  const limit  = parseFloat(budget.limitAmount);
  const spent  = budget.spent;
  const remain = limit - spent;
  const p      = pct(spent, limit);
  const status = statusConfig(p);
  const StatusIcon = status.Icon;
  const emoji  = getCategoryEmoji(budget.category);

  return (
    <div className={cn(
      "group relative bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all p-5 flex flex-col gap-4",
      p >= 100 ? "border-red-200" : p >= 80 ? "border-amber-200" : "border-slate-100",
      !budget.isActive && "opacity-60"
    )}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="text-3xl flex-shrink-0">{emoji}</div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 truncate">{budget.category}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {PERIOD_LABELS[budget.period]} · {budget.currency}
          </p>
        </div>
        {/* Status badge */}
        <div className={cn("flex items-center gap-1 text-xs font-medium flex-shrink-0", status.text)}>
          <StatusIcon className="w-3.5 h-3.5" />
          {status.label}
        </div>
        {/* Edit/Delete */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4">
          <button
            onClick={() => onEdit(budget)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(budget.id)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Amounts */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-slate-400 mb-0.5">Gastado</p>
          <p className={cn("text-xl font-bold tabular-nums", spent > limit ? "text-red-600" : "text-slate-900")}>
            {fmt(spent, budget.currency)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400 mb-0.5">Límite</p>
          <p className="text-lg font-semibold text-slate-500 tabular-nums">
            {fmt(limit, budget.currency)}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", status.color)}
            style={{ width: `${p}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <p className="text-xs font-medium text-slate-500">{p.toFixed(0)}% usado</p>
          <p className={cn("text-xs font-medium", remain < 0 ? "text-red-500" : "text-slate-500")}>
            {remain >= 0 ? `${fmt(remain, budget.currency)} disponible` : `${fmt(Math.abs(remain), budget.currency)} excedido`}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Budget Modal ──────────────────────────────────────────────────────────────

function BudgetModal({
  budget,
  businesses,
  onClose,
  onSaved,
}: {
  budget: BudgetRow | null;
  businesses: BusinessOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!budget;
  const [category,    setCategory]    = useState(budget?.category    ?? "");
  const [limitAmount, setLimitAmount] = useState(budget ? parseFloat(budget.limitAmount).toString() : "");
  const [currency,    setCurrency]    = useState(budget?.currency    ?? "MXN");
  const [period,      setPeriod]      = useState<BudgetRow["period"]>(budget?.period ?? "monthly");
  const [businessId,  setBusinessId]  = useState(budget?.businessId  ?? "");
  const [isActive,    setIsActive]    = useState(budget?.isActive    ?? true);
  const [notes,       setNotes]       = useState(budget?.notes       ?? "");
  const [saving,      setSaving]      = useState(false);
  const [customCat,   setCustomCat]   = useState(
    budget?.category && !BUDGET_CATEGORIES.find((c) => c.label === budget.category) ? budget.category : ""
  );
  const [useCustom, setUseCustom] = useState(
    !!(budget?.category && !BUDGET_CATEGORIES.find((c) => c.label === budget.category))
  );

  const finalCategory = useCustom ? customCat : category;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!finalCategory || !limitAmount) return;
    setSaving(true);
    try {
      const payload = {
        category:    finalCategory,
        limitAmount: parseFloat(limitAmount),
        currency,
        period,
        businessId: businessId || null,
        isActive,
        notes: notes.trim() || null,
      };
      const res = isEdit
        ? await fetch(`/api/budgets/${budget!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/budgets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (res.ok) onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">
            {isEdit ? "Editar presupuesto" : "Nuevo presupuesto"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Categoría *</label>
            {!useCustom ? (
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                required={!useCustom}
              >
                <option value="">Selecciona...</option>
                {BUDGET_CATEGORIES.map((c) => (
                  <option key={c.label} value={c.label}>{c.emoji} {c.label}</option>
                ))}
              </select>
            ) : (
              <input
                value={customCat}
                onChange={(e) => setCustomCat(e.target.value)}
                placeholder="Escribe la categoría..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                required={useCustom}
              />
            )}
            <button
              type="button"
              onClick={() => { setUseCustom((v) => !v); setCategory(""); setCustomCat(""); }}
              className="text-xs text-slate-400 hover:text-slate-600 mt-1"
            >
              {useCustom ? "← Usar lista predefinida" : "Escribir categoría personalizada →"}
            </button>
          </div>

          {/* Amount + Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Límite mensual *</label>
              <input
                type="number"
                step="any"
                min="1"
                value={limitAmount}
                onChange={(e) => setLimitAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 text-right"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Moneda</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
              >
                <option value="MXN">🇲🇽 MXN</option>
                <option value="USD">🇺🇸 USD</option>
                <option value="EUR">🇪🇺 EUR</option>
                <option value="other">Otra</option>
              </select>
            </div>
          </div>

          {/* Period */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Período</label>
            <div className="flex gap-2">
              {(["weekly", "monthly", "yearly"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-medium border transition-colors",
                    period === p
                      ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                      : "border-slate-200 text-slate-500 hover:bg-slate-50"
                  )}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Business */}
          {businesses.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Negocio</label>
              <select
                value={businessId}
                onChange={(e) => setBusinessId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
              >
                <option value="">Personal</option>
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>{b.logo || "🏢"} {b.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notas</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
            />
          </div>

          {/* Active toggle (edit only) */}
          {isEdit && (
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setIsActive((v) => !v)}
                className={cn("relative w-10 h-5 rounded-full transition-colors", isActive ? "bg-[#1e3a5f]" : "bg-slate-200")}
              >
                <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform", isActive ? "translate-x-5" : "translate-x-0.5")} />
              </div>
              <span className="text-sm text-slate-700">Activo</span>
            </label>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !finalCategory || !limitAmount}
              className="flex-1 px-4 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#162d4a] transition-colors disabled:opacity-50"
            >
              {saving ? "Guardando..." : isEdit ? "Guardar" : "Crear"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Summary Bar ───────────────────────────────────────────────────────────────

function SummaryBar({ budgets }: { budgets: BudgetRow[] }) {
  const active = budgets.filter((b) => b.isActive);
  if (active.length === 0) return null;

  // Group by currency
  const byCurrency: Record<string, { limit: number; spent: number }> = {};
  for (const b of active) {
    const cur = b.currency;
    if (!byCurrency[cur]) byCurrency[cur] = { limit: 0, spent: 0 };
    byCurrency[cur].limit += parseFloat(b.limitAmount);
    byCurrency[cur].spent += b.spent;
  }

  const overBudget = active.filter((b) => b.spent > parseFloat(b.limitAmount)).length;
  const atRisk     = active.filter((b) => {
    const p = pct(b.spent, parseFloat(b.limitAmount));
    return p >= 80 && p < 100;
  }).length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
        <p className="text-xs text-slate-400">Categorías</p>
        <p className="text-2xl font-bold text-slate-900 mt-1">{active.length}</p>
      </div>
      {overBudget > 0 && (
        <div className="bg-red-50 rounded-xl border border-red-200 shadow-sm p-4">
          <p className="text-xs text-red-500">Superados</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{overBudget}</p>
        </div>
      )}
      {atRisk > 0 && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 shadow-sm p-4">
          <p className="text-xs text-amber-600">Al límite</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{atRisk}</p>
        </div>
      )}
      {Object.entries(byCurrency).map(([cur, { limit, spent }]) => {
        const sym = currencySymbol[cur] ?? "";
        return (
          <div key={cur} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <p className="text-xs text-slate-400">Gasto vs límite {cur}</p>
            <p className="text-lg font-bold text-slate-900 mt-1 tabular-nums">
              {sym}{spent.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
              <span className="text-sm font-normal text-slate-400">
                {" "}/ {sym}{limit.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
              </span>
            </p>
            {/* Global progress */}
            <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full", statusConfig(pct(spent, limit)).color)}
                style={{ width: `${pct(spent, limit)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function BudgetsList({
  initialBudgets,
  businesses,
  periodLabel,
}: {
  initialBudgets: BudgetRow[];
  businesses: BusinessOption[];
  periodLabel: string;
}) {
  const router = useRouter();
  const [budgetList, setBudgetList] = useState(initialBudgets);
  const [modal,      setModal]      = useState<BudgetRow | null | undefined>(undefined);
  const [showInactive, setShowInactive] = useState(false);

  function handleSaved() {
    setModal(undefined);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este presupuesto?")) return;
    await fetch(`/api/budgets/${id}`, { method: "DELETE" });
    setBudgetList((prev) => prev.filter((b) => b.id !== id));
  }

  const active   = budgetList.filter((b) => b.isActive);
  const inactive = budgetList.filter((b) => !b.isActive);

  // Sort: overbudget first, then by % descending
  const sorted = [...active].sort((a, b) => {
    const pa = pct(a.spent, parseFloat(a.limitAmount));
    const pb = pct(b.spent, parseFloat(b.limitAmount));
    return pb - pa;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Presupuestos</h1>
          <p className="text-sm text-slate-500 mt-0.5">{periodLabel}</p>
        </div>
        <button
          onClick={() => setModal(null)}
          className="flex items-center gap-2 px-4 py-2 bg-[#1e3a5f] text-white rounded-xl text-sm font-medium hover:bg-[#162d4a] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo
        </button>
      </div>

      {/* Sub-nav */}
      <FinanceSubnav active="/finanzas/presupuesto" />

      {/* Summary */}
      {active.length > 0 && <SummaryBar budgets={budgetList} />}

      {/* Empty state */}
      {budgetList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-5xl mb-4">🎯</div>
          <p className="text-slate-500 font-medium">Sin presupuestos definidos</p>
          <p className="text-slate-400 text-sm mt-1">
            Define límites de gasto por categoría para controlar tu dinero
          </p>
          <button
            onClick={() => setModal(null)}
            className="mt-4 px-4 py-2 bg-[#1e3a5f] text-white rounded-xl text-sm font-medium hover:bg-[#162d4a] transition-colors"
          >
            Crear primer presupuesto
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active budgets grid */}
          {sorted.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sorted.map((b) => (
                <BudgetCard key={b.id} budget={b} onEdit={setModal} onDelete={handleDelete} />
              ))}
            </div>
          )}

          {/* Inactive */}
          {inactive.length > 0 && (
            <div>
              <button
                onClick={() => setShowInactive((v) => !v)}
                className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1.5 mb-3"
              >
                {showInactive ? "▾" : "▸"} {inactive.length} inactivo{inactive.length !== 1 ? "s" : ""}
              </button>
              {showInactive && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {inactive.map((b) => (
                    <BudgetCard key={b.id} budget={b} onEdit={setModal} onDelete={handleDelete} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {modal !== undefined && (
        <BudgetModal
          budget={modal}
          businesses={businesses}
          onClose={() => setModal(undefined)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
