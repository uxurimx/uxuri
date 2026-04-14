"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, X, Pencil, Trash2, CheckCircle2, SkipForward,
  AlertCircle, Clock, CalendarDays, RefreshCw, Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FinanceSubnav } from "./finance-dashboard";

// ── Types ─────────────────────────────────────────────────────────────────────

export type BillRow = {
  id: string;
  userId: string;
  accountId: string | null;
  businessId: string | null;
  name: string;
  amount: string;
  currency: string;
  frequency: "weekly" | "biweekly" | "monthly" | "bimonthly" | "quarterly" | "yearly" | "once";
  nextDueDate: string;
  category: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type AccountOption = { id: string; name: string; icon: string | null; currency: string };
type BusinessOption = { id: string; name: string; logo: string | null };

// ── Config ────────────────────────────────────────────────────────────────────

const BILL_CATEGORIES = [
  "Renta", "Hipoteca", "Internet", "Teléfono", "Gas", "Luz", "Agua",
  "Escuela", "Seguro", "Streaming", "Software/Suscripciones",
  "Gym/Salud", "Crédito", "Impuestos", "Nómina", "Otro",
];

const FREQUENCY_LABELS: Record<BillRow["frequency"], string> = {
  weekly:    "Semanal",
  biweekly:  "Quincenal",
  monthly:   "Mensual",
  bimonthly: "Bimestral",
  quarterly: "Trimestral",
  yearly:    "Anual",
  once:      "Una vez",
};

const currencySymbol: Record<string, string> = {
  MXN: "$", USD: "$", EUR: "€", BTC: "₿", ETH: "Ξ", USDT: "$", other: "",
};

function formatAmount(amount: string, currency: string) {
  const num = parseFloat(amount);
  const sym = currencySymbol[currency] ?? "";
  if (["BTC", "ETH"].includes(currency)) return `${num.toFixed(6)} ${currency}`;
  return `${sym}${num.toLocaleString("es-MX", { minimumFractionDigits: 2 })} ${currency}`;
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

// Returns days until due (negative = overdue)
function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + "T12:00:00");
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

function urgencyConfig(days: number) {
  if (days < 0)  return { label: `Vencido hace ${Math.abs(days)}d`, dot: "bg-red-500",   badge: "bg-red-50 text-red-600 border-red-200",     border: "border-red-200",   icon: AlertCircle };
  if (days === 0) return { label: "Vence hoy",                        dot: "bg-red-500",   badge: "bg-red-50 text-red-600 border-red-200",     border: "border-red-200",   icon: AlertCircle };
  if (days <= 3)  return { label: `En ${days}d`,                      dot: "bg-amber-400", badge: "bg-amber-50 text-amber-700 border-amber-200", border: "border-amber-200", icon: Clock };
  if (days <= 7)  return { label: `En ${days}d`,                      dot: "bg-yellow-400",badge: "bg-yellow-50 text-yellow-700 border-yellow-200", border: "border-slate-100", icon: Clock };
  return           { label: `En ${days}d`,                            dot: "bg-emerald-400",badge: "bg-emerald-50 text-emerald-700 border-emerald-200", border: "border-slate-100", icon: CalendarDays };
}

// ── Pay Modal ─────────────────────────────────────────────────────────────────

function PayModal({
  bill,
  accounts,
  onClose,
  onPaid,
}: {
  bill: BillRow;
  accounts: AccountOption[];
  onClose: () => void;
  onPaid: () => void;
}) {
  const [paidDate, setPaidDate]     = useState(todayISO());
  const [amount, setAmount]         = useState(parseFloat(bill.amount).toString());
  const [accountId, setAccountId]   = useState(bill.accountId ?? accounts[0]?.id ?? "");
  const [notes, setNotes]           = useState("");
  const [status, setStatus]         = useState<"paid" | "skipped">("paid");
  const [saving, setSaving]         = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/bills/${bill.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paidDate,
          amount: parseFloat(amount),
          accountId: accountId || null,
          notes: notes.trim() || null,
          status,
        }),
      });
      if (res.ok) onPaid();
    } finally {
      setSaving(false);
    }
  }

  const days = daysUntil(bill.nextDueDate);
  const urgency = urgencyConfig(days);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Registrar pago</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Bill name */}
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="font-medium text-slate-900">{bill.name}</p>
            <p className="text-sm text-slate-500">
              {formatAmount(bill.amount, bill.currency)} · {FREQUENCY_LABELS[bill.frequency]}
            </p>
          </div>

          {/* Status: paid / skipped */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStatus("paid")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium border transition-colors",
                status === "paid"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "border-slate-200 text-slate-400 hover:bg-slate-50"
              )}
            >
              <CheckCircle2 className="w-4 h-4" /> Pagado
            </button>
            <button
              type="button"
              onClick={() => setStatus("skipped")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium border transition-colors",
                status === "skipped"
                  ? "bg-slate-100 text-slate-600 border-slate-300"
                  : "border-slate-200 text-slate-400 hover:bg-slate-50"
              )}
            >
              <SkipForward className="w-4 h-4" /> Omitir
            </button>
          </div>

          {status === "paid" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                  <input
                    type="date"
                    value={paidDate}
                    onChange={(e) => setPaidDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Monto</label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 text-right"
                    required
                  />
                </div>
              </div>

              {accounts.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cuenta</label>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                  >
                    <option value="">Sin cuenta (solo registro)</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.icon || "💰"} {a.name}
                      </option>
                    ))}
                  </select>
                  {accountId && (
                    <p className="text-xs text-slate-400 mt-1">
                      Se creará un egreso automáticamente en esta cuenta.
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notas</label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Opcional"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#162d4a] transition-colors disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Confirmar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Bill Modal (create / edit) ─────────────────────────────────────────────────

function BillModal({
  bill,
  accounts,
  businesses,
  onClose,
  onSaved,
}: {
  bill: BillRow | null;
  accounts: AccountOption[];
  businesses: BusinessOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!bill;

  const [name, setName]           = useState(bill?.name ?? "");
  const [amount, setAmount]       = useState(bill ? parseFloat(bill.amount).toString() : "");
  const [currency, setCurrency]   = useState(bill?.currency ?? "MXN");
  const [frequency, setFrequency] = useState<BillRow["frequency"]>(bill?.frequency ?? "monthly");
  const [nextDueDate, setNextDueDate] = useState(bill?.nextDueDate ?? todayISO());
  const [category, setCategory]   = useState(bill?.category ?? "");
  const [accountId, setAccountId] = useState(bill?.accountId ?? accounts[0]?.id ?? "");
  const [businessId, setBusinessId] = useState(bill?.businessId ?? "");
  const [isActive, setIsActive]   = useState(bill?.isActive ?? true);
  const [notes, setNotes]         = useState(bill?.notes ?? "");
  const [saving, setSaving]       = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !amount || !nextDueDate) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        amount: parseFloat(amount),
        currency,
        frequency,
        nextDueDate,
        category: category || null,
        accountId: accountId || null,
        businessId: businessId || null,
        isActive,
        notes: notes.trim() || null,
      };
      const res = isEdit
        ? await fetch(`/api/bills/${bill!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/bills", {
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
            {isEdit ? "Editar pago recurrente" : "Nuevo pago recurrente"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Renta, Internet Telmex, Netflix..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Monto *</label>
              <input
                type="number"
                step="any"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Frecuencia</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as BillRow["frequency"])}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
              >
                {Object.entries(FREQUENCY_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Próximo vencimiento *</label>
              <input
                type="date"
                value={nextDueDate}
                onChange={(e) => setNextDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
            >
              <option value="">Sin categoría</option>
              {BILL_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {accounts.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Cuenta predeterminada
                <span className="text-xs font-normal text-slate-400 ml-1">(para cargar al pagar)</span>
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
              >
                <option value="">Sin cuenta</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.icon || "💰"} {a.name} ({a.currency})
                  </option>
                ))}
              </select>
            </div>
          )}

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

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notas</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Proveedor, número de cuenta, referencia..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
            />
          </div>

          {isEdit && (
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setIsActive((v) => !v)}
                className={cn(
                  "relative w-10 h-5 rounded-full transition-colors",
                  isActive ? "bg-[#1e3a5f]" : "bg-slate-200"
                )}
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
              disabled={saving || !name.trim() || !amount || !nextDueDate}
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

// ── Bill Card ─────────────────────────────────────────────────────────────────

function BillCard({
  bill,
  onPay,
  onEdit,
  onDelete,
}: {
  bill: BillRow;
  onPay: (b: BillRow) => void;
  onEdit: (b: BillRow) => void;
  onDelete: (id: string) => void;
}) {
  const days = daysUntil(bill.nextDueDate);
  const urgency = urgencyConfig(days);
  const UrgencyIcon = urgency.icon;

  const dateStr = new Date(bill.nextDueDate + "T12:00:00").toLocaleDateString("es-MX", {
    day: "numeric", month: "short", year: "numeric",
  });

  return (
    <div
      className={cn(
        "group relative bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all p-5 flex flex-col gap-3",
        bill.isActive ? urgency.border : "border-slate-100 opacity-60"
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={cn("w-2 h-2 rounded-full mt-2 flex-shrink-0", bill.isActive ? urgency.dot : "bg-slate-300")} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 truncate">{bill.name}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
            <span className="text-xs text-slate-500">{FREQUENCY_LABELS[bill.frequency]}</span>
            {bill.category && (
              <>
                <span className="text-slate-200 text-xs">·</span>
                <span className="text-xs text-slate-400">{bill.category}</span>
              </>
            )}
          </div>
        </div>
        {/* Edit/delete */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(bill)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(bill.id)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Amount */}
      <p className="text-2xl font-bold tabular-nums text-slate-900">
        {formatAmount(bill.amount, bill.currency)}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-50">
        <div className="flex items-center gap-1.5">
          <UrgencyIcon className={cn("w-3.5 h-3.5", days < 0 ? "text-red-500" : days <= 3 ? "text-amber-500" : "text-slate-400")} />
          <span className={cn("text-xs font-medium", days < 0 || days === 0 ? "text-red-600" : days <= 3 ? "text-amber-600" : "text-slate-500")}>
            {dateStr}
          </span>
          {bill.isActive && (
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-medium", urgency.badge)}>
              {urgency.label}
            </span>
          )}
        </div>
        {bill.isActive && (
          <button
            onClick={() => onPay(bill)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Pagar
          </button>
        )}
      </div>
    </div>
  );
}

// ── Summary Bar ───────────────────────────────────────────────────────────────

function SummaryBar({ bills }: { bills: BillRow[] }) {
  const active = bills.filter((b) => b.isActive);
  // Group monthly equivalent cost by currency
  const monthly: Record<string, number> = {};
  const multiplier: Record<BillRow["frequency"], number> = {
    weekly: 4.33, biweekly: 2.17, monthly: 1, bimonthly: 0.5,
    quarterly: 0.33, yearly: 0.083, once: 0,
  };
  for (const b of active) {
    const m = multiplier[b.frequency];
    monthly[b.currency] = (monthly[b.currency] ?? 0) + parseFloat(b.amount) * m;
  }

  const overdue = active.filter((b) => daysUntil(b.nextDueDate) < 0).length;
  const dueSoon = active.filter((b) => { const d = daysUntil(b.nextDueDate); return d >= 0 && d <= 7; }).length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
        <p className="text-xs text-slate-400">Total activos</p>
        <p className="text-2xl font-bold text-slate-900 mt-1">{active.length}</p>
      </div>
      {overdue > 0 && (
        <div className="bg-red-50 rounded-xl border border-red-200 shadow-sm p-4">
          <p className="text-xs text-red-500">Vencidos</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{overdue}</p>
        </div>
      )}
      {dueSoon > 0 && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 shadow-sm p-4">
          <p className="text-xs text-amber-600">Esta semana</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{dueSoon}</p>
        </div>
      )}
      {Object.entries(monthly).map(([cur, total]) => (
        <div key={cur} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs text-slate-400">Costo mensual {cur}</p>
          <p className="text-lg font-bold text-slate-900 mt-1 tabular-nums">
            {currencySymbol[cur] ?? ""}{total.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function BillsList({
  initialBills,
  accounts,
  businesses,
}: {
  initialBills: BillRow[];
  accounts: AccountOption[];
  businesses: BusinessOption[];
}) {
  const router = useRouter();
  const [billList, setBillList]   = useState(initialBills);
  useEffect(() => { setBillList(initialBills); }, [initialBills]);
  const [modal, setModal]         = useState<BillRow | null | undefined>(undefined);
  const [payModal, setPayModal]   = useState<BillRow | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  function handleSaved() {
    setModal(undefined);
    router.refresh();
  }

  function handlePaid() {
    setPayModal(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este pago recurrente?")) return;
    await fetch(`/api/bills/${id}`, { method: "DELETE" });
    setBillList((prev) => prev.filter((b) => b.id !== id));
  }

  const active   = billList.filter((b) => b.isActive).sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate));
  const inactive = billList.filter((b) => !b.isActive);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pagos recurrentes</h1>
          <p className="text-sm text-slate-500 mt-0.5">{active.length} activo{active.length !== 1 ? "s" : ""}</p>
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
      <FinanceSubnav active="/finanzas/pagos" />

      {/* Summary */}
      {active.length > 0 && <SummaryBar bills={billList} />}

      {/* Empty state */}
      {billList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <RefreshCw className="w-12 h-12 text-slate-200 mb-4" />
          <p className="text-slate-500 font-medium">Sin pagos recurrentes</p>
          <p className="text-slate-400 text-sm mt-1">
            Registra renta, internet, suscripciones o cualquier gasto periódico
          </p>
          <button
            onClick={() => setModal(null)}
            className="mt-4 px-4 py-2 bg-[#1e3a5f] text-white rounded-xl text-sm font-medium hover:bg-[#162d4a] transition-colors"
          >
            Crear primer pago
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active bills */}
          {active.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {active.map((b) => (
                <BillCard
                  key={b.id}
                  bill={b}
                  onPay={setPayModal}
                  onEdit={setModal}
                  onDelete={handleDelete}
                />
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
                    <BillCard
                      key={b.id}
                      bill={b}
                      onPay={setPayModal}
                      onEdit={setModal}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create / Edit modal */}
      {modal !== undefined && (
        <BillModal
          bill={modal}
          accounts={accounts}
          businesses={businesses}
          onClose={() => setModal(undefined)}
          onSaved={handleSaved}
        />
      )}

      {/* Pay modal */}
      {payModal && (
        <PayModal
          bill={payModal}
          accounts={accounts}
          onClose={() => setPayModal(null)}
          onPaid={handlePaid}
        />
      )}
    </div>
  );
}
