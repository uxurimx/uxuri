"use client";

import { useState } from "react";
import { X, ArrowUpRight, ArrowDownRight, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AccountOption = {
  id: string;
  name: string;
  icon: string | null;
  currency: string;
  businessId: string | null;
};

export type TransactionForModal = {
  id: string;
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
};

type ClientOption = { id: string; name: string };
type ProjectOption = { id: string; name: string };
type BusinessOption = { id: string; name: string; logo: string | null };

// ── Config ────────────────────────────────────────────────────────────────────

const INCOME_CATEGORIES = [
  "Venta", "Servicio", "Pago de cliente", "Salario", "Inversión",
  "Devolución", "Transferencia recibida", "Otro",
];

const EXPENSE_CATEGORIES = [
  "Renta", "Internet", "Gas/Servicios", "Escuela", "Alimentación",
  "Transporte", "Marketing", "Software/Suscripciones", "Sueldos",
  "Impuestos", "Retiro", "Transferencia enviada", "Otro",
];

const STATUS_OPTIONS = [
  { value: "completed", label: "Completada" },
  { value: "pending",   label: "Pendiente" },
  { value: "cancelled", label: "Cancelada" },
];

function todayISO() {
  return new Intl.DateTimeFormat("en-CA").format(new Date());
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TransactionModal({
  transaction,
  accounts,
  clients,
  projects,
  businesses,
  defaultAccountId,
  defaultType = "income",
  defaultClientId,
  onClose,
  onSaved,
}: {
  transaction?: TransactionForModal | null;
  accounts: AccountOption[];
  clients: ClientOption[];
  projects: ProjectOption[];
  businesses: BusinessOption[];
  defaultAccountId?: string;
  defaultType?: "income" | "expense" | "transfer";
  defaultClientId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!transaction;

  const [type, setType]               = useState<"income" | "expense" | "transfer">(transaction?.type ?? defaultType);
  const [accountId, setAccountId]     = useState(transaction?.accountId ?? defaultAccountId ?? accounts[0]?.id ?? "");
  const [toAccountId, setToAccountId] = useState(transaction?.toAccountId ?? "");
  const [amount, setAmount]           = useState(transaction ? parseFloat(transaction.amount).toString() : "");
  const [description, setDescription] = useState(transaction?.description ?? "");
  const [date, setDate]               = useState(transaction?.date ?? todayISO());
  const [category, setCategory]       = useState(transaction?.category ?? "");
  const [status, setStatus]           = useState<"completed" | "pending" | "cancelled">(transaction?.status ?? "completed");
  const [clientId, setClientId]       = useState(transaction?.clientId ?? defaultClientId ?? "");
  const [projectId, setProjectId]     = useState(transaction?.projectId ?? "");
  const [businessId, setBusinessId]   = useState(transaction?.businessId ?? "");
  const [notes, setNotes]             = useState(transaction?.notes ?? "");
  const [showAdvanced, setShowAdvanced] = useState(
    !!(transaction?.clientId || transaction?.projectId || transaction?.businessId || transaction?.notes || transaction?.exchangeRateMXN)
  );
  const [exchangeRate, setExchangeRate] = useState(transaction?.exchangeRateMXN ?? "");
  const [saving, setSaving]           = useState(false);

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const categories = type === "income" ? INCOME_CATEGORIES : type === "expense" ? EXPENSE_CATEGORIES : [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId || !amount || !description || !date) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        accountId,
        type,
        amount: parseFloat(amount),
        currency: selectedAccount?.currency ?? "MXN",
        description: description.trim(),
        date,
        status,
        category:      category || null,
        toAccountId:   type === "transfer" && toAccountId ? toAccountId : null,
        businessId:    businessId || null,
        clientId:      clientId   || null,
        projectId:     projectId  || null,
        notes:         notes.trim() || null,
        exchangeRateMXN: exchangeRate ? parseFloat(exchangeRate) : null,
      };

      const res = isEdit
        ? await fetch(`/api/transactions/${transaction!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/transactions", {
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">
            {isEdit ? "Editar transacción" : "Nueva transacción"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Type toggle */}
          <div className="flex rounded-xl border border-slate-200 overflow-hidden">
            {(["income", "expense", "transfer"] as const).map((t) => {
              const cfg = {
                income:   { label: "Ingreso",     icon: ArrowUpRight,    active: "bg-emerald-500 text-white" },
                expense:  { label: "Egreso",       icon: ArrowDownRight,  active: "bg-red-500 text-white" },
                transfer: { label: "Transferencia",icon: ArrowLeftRight,  active: "bg-blue-500 text-white" },
              }[t];
              const Icon = cfg.icon;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setType(t); setCategory(""); }}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors",
                    type === t ? cfg.active : "text-slate-500 hover:bg-slate-50"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {cfg.label}
                </button>
              );
            })}
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Monto *{selectedAccount ? ` (${selectedAccount.currency})` : ""}
            </label>
            <input
              type="number"
              step="any"
              min="0.000001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 text-right tabular-nums"
              required
            />
          </div>

          {/* Account */}
          <div className={cn("grid gap-3", type === "transfer" ? "grid-cols-2" : "grid-cols-1")}>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {type === "transfer" ? "Cuenta origen *" : "Cuenta *"}
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                required
              >
                <option value="">Selecciona...</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.icon || "💰"} {a.name} ({a.currency})
                  </option>
                ))}
              </select>
            </div>
            {type === "transfer" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cuenta destino *</label>
                <select
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                  required={type === "transfer"}
                >
                  <option value="">Selecciona...</option>
                  {accounts
                    .filter((a) => a.id !== accountId)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.icon || "💰"} {a.name} ({a.currency})
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          {/* Description + Date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descripción *</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                type === "income"   ? "Ej: Pago proyecto X de cliente Y..." :
                type === "expense"  ? "Ej: Renta oficina enero..." :
                "Ej: Traspaso BBVA → Stripe"
              }
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fecha *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                required
              />
            </div>
            {categories.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                >
                  <option value="">Sin categoría</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStatus(s.value as typeof status)}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                    status === s.value
                      ? s.value === "completed" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : s.value === "pending"  ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-slate-100 text-slate-500 border-slate-200"
                      : "border-slate-200 text-slate-400 hover:bg-slate-50"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Advanced toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            {showAdvanced ? "▾ Ocultar opciones" : "▸ Más opciones (cliente, proyecto, negocio, notas)"}
          </button>

          {showAdvanced && (
            <div className="space-y-3 pt-1 border-t border-slate-50">
              {clients.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cliente</label>
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                  >
                    <option value="">Sin cliente</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {projects.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Proyecto</label>
                  <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                  >
                    <option value="">Sin proyecto</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
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
                    <option value="">Personal / Sin negocio</option>
                    {businesses.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.logo || "🏢"} {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tipo de cambio MXN
                  <span className="text-xs font-normal text-slate-400 ml-1">(si aplica)</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                  placeholder="Ej: 17.50"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notas</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notas adicionales..."
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 resize-none"
                />
              </div>
            </div>
          )}

          {/* Actions */}
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
              disabled={saving || !accountId || !amount || !description || !date}
              className={cn(
                "flex-1 px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50",
                type === "income"   ? "bg-emerald-600 hover:bg-emerald-700" :
                type === "expense"  ? "bg-red-600 hover:bg-red-700" :
                "bg-blue-600 hover:bg-blue-700"
              )}
            >
              {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Registrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
