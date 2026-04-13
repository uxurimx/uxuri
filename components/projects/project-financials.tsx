"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DollarSign, Plus, CheckCircle2, Clock, AlertCircle, XCircle,
  ChevronDown, ChevronRight, Trash2, Pencil, Check, X,
  CreditCard, Banknote, Smartphone, Bitcoin
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AccountOption = {
  id: string;
  name: string;
  icon: string | null;
  currency: string;
  businessId: string | null;
};

type Phase = {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  order: number;
  status: "pending" | "active" | "completed" | "cancelled";
  completionPercent: number;
  dueDate: string | null;
  billingAmount: string | null;
  billingCurrency: string;
  billedAt: string | null;
  createdAt: string;
};

type Payment = {
  id: string;
  projectId: string;
  concept: string;
  amount: string;
  currency: string;
  type: "anticipo" | "abono" | "pago_final" | "reembolso" | "otro";
  status: "pending" | "paid" | "overdue" | "cancelled";
  method: string | null;
  dueDate: string | null;
  paidAt: string | null;
  phaseId: string | null;
  notes: string | null;
  reference: string | null;
  createdAt: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CURRENCY_SYMBOL: Record<string, string> = {
  MXN: "$", USD: "US$", EUR: "€",
};

function fmt(amount: string | number | null, currency = "MXN") {
  if (!amount) return "—";
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  const sym = CURRENCY_SYMBOL[currency] ?? currency + " ";
  return sym + n.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

const phaseStatusConfig = {
  pending:   { label: "Pendiente",  icon: Clock,        className: "text-slate-500 bg-slate-50 border-slate-200" },
  active:    { label: "En curso",   icon: ChevronRight, className: "text-blue-600 bg-blue-50 border-blue-200" },
  completed: { label: "Completada", icon: CheckCircle2, className: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  cancelled: { label: "Cancelada",  icon: XCircle,      className: "text-red-500 bg-red-50 border-red-200" },
};

const paymentStatusConfig = {
  pending:   { label: "Pendiente",  dot: "bg-amber-400"  },
  paid:      { label: "Pagado",     dot: "bg-emerald-500" },
  overdue:   { label: "Vencido",    dot: "bg-red-500"    },
  cancelled: { label: "Cancelado",  dot: "bg-slate-300"  },
};

const paymentTypeLabel = {
  anticipo:    "Anticipo",
  abono:       "Abono",
  pago_final:  "Pago final",
  reembolso:   "Reembolso",
  otro:        "Otro",
};

const methodIcon: Record<string, React.ReactNode> = {
  transferencia: <Banknote className="w-3.5 h-3.5" />,
  efectivo:      <Banknote className="w-3.5 h-3.5" />,
  tarjeta:       <CreditCard className="w-3.5 h-3.5" />,
  paypal:        <Smartphone className="w-3.5 h-3.5" />,
  crypto:        <Bitcoin className="w-3.5 h-3.5" />,
};

// ─── Phase Row ────────────────────────────────────────────────────────────────

function PhaseRow({ phase, phases, projectId, onUpdated }: {
  phase: Phase;
  phases: Phase[];
  projectId: string;
  onUpdated: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const cfg = phaseStatusConfig[phase.status];
  const Icon = cfg.icon;

  const [form, setForm] = useState({
    name: phase.name,
    description: phase.description ?? "",
    status: phase.status,
    completionPercent: phase.completionPercent,
    dueDate: phase.dueDate ?? "",
    billingAmount: phase.billingAmount ?? "",
  });

  async function save() {
    setSaving(true);
    await fetch(`/api/projects/${projectId}/phases/${phase.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        completionPercent: Number(form.completionPercent),
        dueDate: form.dueDate || null,
        billingAmount: form.billingAmount || null,
      }),
    });
    setSaving(false);
    setEditing(false);
    onUpdated();
  }

  async function del() {
    if (!confirm("¿Eliminar esta fase?")) return;
    await fetch(`/api/projects/${projectId}/phases/${phase.id}`, { method: "DELETE" });
    onUpdated();
  }

  async function cycleStatus() {
    const order: Phase["status"][] = ["pending", "active", "completed", "cancelled"];
    const next = order[(order.indexOf(phase.status) + 1) % order.length];
    const autoPercent = next === "completed" ? 100 : next === "active" ? 50 : phase.completionPercent;
    await fetch(`/api/projects/${projectId}/phases/${phase.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next, completionPercent: autoPercent }),
    });
    onUpdated();
  }

  if (editing) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Nombre</label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Estado</label>
            <select
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value as Phase["status"] }))}
            >
              <option value="pending">Pendiente</option>
              <option value="active">En curso</option>
              <option value="completed">Completada</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">% avance</label>
            <input
              type="number" min={0} max={100}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.completionPercent}
              onChange={e => setForm(f => ({ ...f, completionPercent: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Fecha límite</label>
            <input
              type="date"
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.dueDate}
              onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Cobro (MXN)</label>
            <input
              type="text"
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
              value={form.billingAmount}
              onChange={e => setForm(f => ({ ...f, billingAmount: e.target.value }))}
            />
          </div>
        </div>
        <textarea
          className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          rows={2}
          placeholder="Descripción (opcional)"
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => setEditing(false)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <X className="w-3.5 h-3.5" /> Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" /> Guardar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-3 bg-white border border-slate-100 rounded-xl p-3 hover:border-slate-200 transition-colors">
      {/* Status badge + click to cycle */}
      <button
        onClick={cycleStatus}
        title="Click para cambiar estado"
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium cursor-pointer transition-all shrink-0",
          cfg.className
        )}
      >
        <Icon className="w-3.5 h-3.5" />
        {cfg.label}
      </button>

      {/* Progress bar */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-slate-800 truncate">{phase.name}</span>
          {phase.dueDate && (
            <span className="text-xs text-slate-400 shrink-0">{fmtDate(phase.dueDate)}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                phase.status === "completed" ? "bg-emerald-500" :
                phase.status === "active" ? "bg-blue-500" :
                phase.status === "cancelled" ? "bg-slate-300" : "bg-slate-200"
              )}
              style={{ width: `${phase.completionPercent}%` }}
            />
          </div>
          <span className="text-xs text-slate-400 w-8 text-right shrink-0">
            {phase.completionPercent}%
          </span>
        </div>
      </div>

      {/* Billing */}
      {phase.billingAmount && (
        <span className="text-sm font-semibold text-slate-700 shrink-0">
          {fmt(phase.billingAmount, phase.billingCurrency)}
        </span>
      )}

      {/* Actions */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={() => setEditing(true)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={del}
          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Mark Paid Modal ──────────────────────────────────────────────────────────

function MarkPaidModal({ payment, projectId, accounts, onDone, onClose }: {
  payment: Payment;
  projectId: string;
  accounts: AccountOption[];
  onDone: () => void;
  onClose: () => void;
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  async function confirm() {
    setSaving(true);
    await fetch(`/api/projects/${projectId}/payments/${payment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "paid",
        paidAt: new Date().toISOString(),
        accountId: accountId || null,
      }),
    });
    setSaving(false);
    onDone();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="p-5 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Confirmar pago recibido</h3>
          <p className="text-sm text-slate-500 mt-0.5">{payment.concept}</p>
        </div>
        <div className="p-5 space-y-4">
          {/* Amount display */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-emerald-700">{fmt(payment.amount, payment.currency)}</p>
            <p className="text-xs text-emerald-500 mt-0.5">{paymentTypeLabel[payment.type]}</p>
          </div>

          {/* Account selector */}
          {accounts.length > 0 ? (
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">
                ¿En qué cuenta / negocio entra este dinero?
              </label>
              <select
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                value={accountId}
                onChange={e => setAccountId(e.target.value)}
              >
                <option value="">— Sin registrar en finanzas —</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.icon} {acc.name} ({acc.currency})
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">
                Esto creará una transacción de ingreso en tus finanzas automáticamente.
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center">
              No tienes cuentas configuradas. El pago se registrará sin vinculación contable.
            </p>
          )}
        </div>
        <div className="p-5 flex gap-3 border-t border-slate-100">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={confirm}
            disabled={saving}
            className="flex-1 py-2.5 text-sm bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 font-medium"
          >
            {saving ? "Registrando..." : "Confirmar pago"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Payment Row ──────────────────────────────────────────────────────────────

function PaymentRow({ payment, projectId, accounts, onUpdated }: {
  payment: Payment;
  projectId: string;
  accounts: AccountOption[];
  onUpdated: () => void;
}) {
  const [showMarkPaid, setShowMarkPaid] = useState(false);
  const cfg = paymentStatusConfig[payment.status];
  const isPaid = payment.status === "paid";

  async function del() {
    if (!confirm("¿Eliminar este pago?")) return;
    await fetch(`/api/projects/${projectId}/payments/${payment.id}`, { method: "DELETE" });
    onUpdated();
  }

  return (
    <>
      <div className={cn(
        "group flex items-center gap-3 rounded-xl px-4 py-3 border transition-colors",
        isPaid ? "bg-emerald-50/50 border-emerald-100" : "bg-white border-slate-100 hover:border-slate-200"
      )}>
        {/* Status dot */}
        <div className={cn("w-2 h-2 rounded-full shrink-0", cfg.dot)} />

        {/* Concept */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn("text-sm font-medium truncate", isPaid ? "text-slate-500 line-through" : "text-slate-800")}>
              {payment.concept}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">
              {paymentTypeLabel[payment.type]}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            {payment.dueDate && !isPaid && (
              <span className="text-xs text-slate-400">Vence {fmtDate(payment.dueDate)}</span>
            )}
            {payment.paidAt && (
              <span className="text-xs text-emerald-600">Pagado {fmtDate(payment.paidAt)}</span>
            )}
            {payment.method && (
              <span className="flex items-center gap-1 text-xs text-slate-400">
                {methodIcon[payment.method]}
                <span className="capitalize">{payment.method}</span>
              </span>
            )}
            {payment.reference && (
              <span className="text-xs text-slate-400">Ref: {payment.reference}</span>
            )}
          </div>
        </div>

        {/* Amount */}
        <span className={cn(
          "text-base font-bold shrink-0",
          isPaid ? "text-emerald-600" : payment.status === "overdue" ? "text-red-600" : "text-slate-800"
        )}>
          {fmt(payment.amount, payment.currency)}
        </span>

        {/* Actions */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {!isPaid && (
            <button
              onClick={() => setShowMarkPaid(true)}
              title="Marcar como pagado"
              className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"
            >
              <Check className="w-3 h-3" /> Pagado
            </button>
          )}
          <button
            onClick={del}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {showMarkPaid && (
        <MarkPaidModal
          payment={payment}
          projectId={projectId}
          accounts={accounts}
          onDone={onUpdated}
          onClose={() => setShowMarkPaid(false)}
        />
      )}
    </>
  );
}

// ─── Add Phase Form ───────────────────────────────────────────────────────────

function AddPhaseForm({ projectId, order, onAdded, onCancel }: {
  projectId: string;
  order: number;
  onAdded: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    dueDate: "",
    billingAmount: "",
    completionPercent: 0,
  });
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    await fetch(`/api/projects/${projectId}/phases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        order,
        billingAmount: form.billingAmount || null,
        dueDate: form.dueDate || null,
      }),
    });
    setSaving(false);
    onAdded();
  }

  return (
    <form onSubmit={submit} className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <input
            autoFocus
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            placeholder="Nombre de la fase (ej: Diseño, Desarrollo, Deploy...)"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div>
          <input
            type="text"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            placeholder="Cobro $ (opcional)"
            value={form.billingAmount}
            onChange={e => setForm(f => ({ ...f, billingAmount: e.target.value }))}
          />
        </div>
      </div>
      <div>
        <input
          type="date"
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          value={form.dueDate}
          onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
        />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100">
          Cancelar
        </button>
        <button type="submit" disabled={saving || !form.name.trim()} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {saving ? "Guardando..." : "Agregar fase"}
        </button>
      </div>
    </form>
  );
}

// ─── Add Payment Form ─────────────────────────────────────────────────────────

function AddPaymentForm({ projectId, onAdded, onCancel }: {
  projectId: string;
  onAdded: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    concept: "",
    amount: "",
    type: "abono" as Payment["type"],
    method: "" as Payment["method"] | "",
    status: "pending" as Payment["status"],
    dueDate: "",
    notes: "",
    reference: "",
  });
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.concept.trim() || !form.amount) return;
    setSaving(true);
    await fetch(`/api/projects/${projectId}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        method: form.method || null,
        dueDate: form.dueDate || null,
        notes: form.notes || null,
        reference: form.reference || null,
        paidAt: form.status === "paid" ? new Date().toISOString() : null,
      }),
    });
    setSaving(false);
    onAdded();
  }

  return (
    <form onSubmit={submit} className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Concepto *</label>
          <input
            autoFocus
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            placeholder="Ej: Anticipo 50% proyecto"
            value={form.concept}
            onChange={e => setForm(f => ({ ...f, concept: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Monto (MXN) *</label>
          <input
            type="text"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            placeholder="0.00"
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Tipo</label>
          <select
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            value={form.type}
            onChange={e => setForm(f => ({ ...f, type: e.target.value as Payment["type"] }))}
          >
            <option value="anticipo">Anticipo</option>
            <option value="abono">Abono</option>
            <option value="pago_final">Pago final</option>
            <option value="reembolso">Reembolso</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Método</label>
          <select
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            value={form.method ?? ""}
            onChange={e => setForm(f => ({ ...f, method: e.target.value as Payment["method"] }))}
          >
            <option value="">— Seleccionar —</option>
            <option value="transferencia">Transferencia</option>
            <option value="efectivo">Efectivo</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="paypal">PayPal</option>
            <option value="crypto">Crypto</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Estado</label>
          <select
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            value={form.status}
            onChange={e => setForm(f => ({ ...f, status: e.target.value as Payment["status"] }))}
          >
            <option value="pending">Pendiente</option>
            <option value="paid">Pagado</option>
            <option value="overdue">Vencido</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Fecha límite</label>
          <input
            type="date"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            value={form.dueDate}
            onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">Referencia / comprobante</label>
          <input
            type="text"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            placeholder="Número de referencia"
            value={form.reference}
            onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100">
          Cancelar
        </button>
        <button type="submit" disabled={saving || !form.concept.trim() || !form.amount} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {saving ? "Guardando..." : "Registrar pago"}
        </button>
      </div>
    </form>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ProjectFinancials({
  projectId,
  totalAmount,
  currency,
  paymentType,
  accounts = [],
}: {
  projectId: string;
  totalAmount: string | null;
  currency: string | null;
  paymentType: string | null;
  accounts?: AccountOption[];
}) {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingPhase, setAddingPhase] = useState(false);
  const [addingPayment, setAddingPayment] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, pay] = await Promise.all([
      fetch(`/api/projects/${projectId}/phases`).then(r => r.json()),
      fetch(`/api/projects/${projectId}/payments`).then(r => r.json()),
    ]);
    setPhases(Array.isArray(p) ? p : []);
    setPayments(Array.isArray(pay) ? pay : []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const totalPaid = payments
    .filter(p => p.status === "paid")
    .reduce((s, p) => s + parseFloat(p.amount), 0);
  const totalPending = payments
    .filter(p => p.status === "pending" || p.status === "overdue")
    .reduce((s, p) => s + parseFloat(p.amount), 0);
  const totalAgreed = totalAmount ? parseFloat(totalAmount) : null;
  const curr = currency ?? "MXN";
  const sym = CURRENCY_SYMBOL[curr] ?? curr + " ";

  const overallProgress = phases.length > 0
    ? Math.round(phases.reduce((s, p) => s + (p.status === "cancelled" ? 0 : p.completionPercent), 0) / phases.filter(p => p.status !== "cancelled").length)
    : null;

  return (
    <div className="space-y-6">
      {/* ── KPIs ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-100 rounded-xl p-4 text-center">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-1">Total acordado</p>
          <p className="text-xl font-bold text-slate-800">{totalAgreed ? fmt(totalAgreed, curr) : "—"}</p>
          {paymentType && (
            <p className="text-xs text-slate-400 mt-0.5 capitalize">{paymentType}</p>
          )}
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
          <p className="text-xs text-emerald-600 font-medium uppercase tracking-wide mb-1">Cobrado</p>
          <p className="text-xl font-bold text-emerald-700">{sym}{totalPaid.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</p>
          {totalAgreed && totalAgreed > 0 && (
            <p className="text-xs text-emerald-500 mt-0.5">{Math.round((totalPaid / totalAgreed) * 100)}%</p>
          )}
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
          <p className="text-xs text-amber-600 font-medium uppercase tracking-wide mb-1">Por cobrar</p>
          <p className="text-xl font-bold text-amber-700">{sym}{totalPending.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
          <p className="text-xs text-blue-600 font-medium uppercase tracking-wide mb-1">Avance del proyecto</p>
          {overallProgress !== null ? (
            <>
              <p className="text-xl font-bold text-blue-700">{overallProgress}%</p>
              <div className="w-full h-1.5 bg-blue-100 rounded-full mt-1 overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${overallProgress}%` }} />
              </div>
            </>
          ) : (
            <p className="text-xl font-bold text-blue-700">—</p>
          )}
        </div>
      </div>

      {/* ── Fases ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-slate-400" />
            Fases del proyecto
            <span className="text-xs text-slate-400 font-normal">({phases.length})</span>
          </h3>
          {!addingPhase && (
            <button
              onClick={() => setAddingPhase(true)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Añadir fase
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-sm text-slate-400 py-4 text-center">Cargando...</div>
        ) : (
          <div className="space-y-2">
            {phases.map(phase => (
              <PhaseRow
                key={phase.id}
                phase={phase}
                phases={phases}
                projectId={projectId}
                onUpdated={load}
              />
            ))}
            {phases.length === 0 && !addingPhase && (
              <p className="text-sm text-slate-400 text-center py-4">
                Sin fases. Divide el proyecto en etapas para mejor seguimiento.
              </p>
            )}
            {addingPhase && (
              <AddPhaseForm
                projectId={projectId}
                order={phases.length}
                onAdded={() => { setAddingPhase(false); load(); }}
                onCancel={() => setAddingPhase(false)}
              />
            )}
          </div>
        )}
      </div>

      {/* ── Pagos ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-slate-400" />
            Pagos y abonos
            <span className="text-xs text-slate-400 font-normal">({payments.length})</span>
          </h3>
          {!addingPayment && (
            <button
              onClick={() => setAddingPayment(true)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Registrar pago
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-sm text-slate-400 py-4 text-center">Cargando...</div>
        ) : (
          <div className="space-y-2">
            {payments.map(payment => (
              <PaymentRow
                key={payment.id}
                payment={payment}
                projectId={projectId}
                accounts={accounts}
                onUpdated={load}
              />
            ))}
            {payments.length === 0 && !addingPayment && (
              <p className="text-sm text-slate-400 text-center py-4">
                Sin pagos registrados. Agrega anticipos, abonos y pagos finales.
              </p>
            )}
            {addingPayment && (
              <AddPaymentForm
                projectId={projectId}
                onAdded={() => { setAddingPayment(false); load(); }}
                onCancel={() => setAddingPayment(false)}
              />
            )}
          </div>
        )}

        {/* Payment progress bar */}
        {totalAgreed && totalAgreed > 0 && (totalPaid > 0 || totalPending > 0) && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
              <span>Progreso de cobros</span>
              <span>{fmt(totalPaid, curr)} de {fmt(totalAgreed, curr)}</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, (totalPaid / totalAgreed) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
