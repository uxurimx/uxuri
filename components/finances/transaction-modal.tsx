"use client";

import { useState, useEffect, useRef } from "react";
import { X, ArrowUpRight, ArrowDownRight, ArrowLeftRight, Search, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AccountOption = {
  id: string;
  name: string;
  icon: string | null;
  currency: string;
  businessId: string | null;
  type?: string;
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

  // External account lookup (for transfer to other users)
  const [destMode, setDestMode]         = useState<"own" | "external">("own");
  const [extAddress, setExtAddress]     = useState("");
  const [extSearching, setExtSearching] = useState(false);
  const [extAccount, setExtAccount]     = useState<{ id: string; name: string; icon: string | null; currency: string; ownerName: string | null; isOwn: boolean } | null>(null);
  const [extError, setExtError]         = useState("");
  const extInputRef                     = useRef<HTMLInputElement>(null);

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const categories = type === "income" ? INCOME_CATEGORIES : type === "expense" ? EXPENSE_CATEGORIES : [];
  const showToAccount = type === "transfer" || (type === "expense" && category === "Sueldos");

  // Reset dest mode when switching away from transfer
  useEffect(() => {
    if (type !== "transfer") { setDestMode("own"); setExtAccount(null); setExtError(""); }
  }, [type]);

  // Sueldos: lookup nomina by wallet address
  const [sueldosAddr, setSueldosAddr]       = useState("");
  const [sueldosSearching, setSueldosSearching] = useState(false);
  const [sueldosAccount, setSueldosAccount] = useState<{ id: string; name: string; icon: string | null; currency: string; ownerName: string | null; isOwn: boolean } | null>(null);
  const [sueldosError, setSueldosError]     = useState("");
  const sueldosInputRef                     = useRef<HTMLInputElement>(null);

  // Reset sueldos state when leaving Sueldos category
  useEffect(() => {
    if (category !== "Sueldos") { setSueldosAddr(""); setSueldosAccount(null); setSueldosError(""); }
  }, [category]);

  async function lookupSueldos() {
    const addr = sueldosAddr.trim().toLowerCase();
    if (!addr) return;
    setSueldosSearching(true);
    setSueldosError("");
    setSueldosAccount(null);
    try {
      const res = await fetch(`/api/accounts/lookup?address=${encodeURIComponent(addr)}`);
      const data = await res.json();
      if (!res.ok) { setSueldosError(data.error ?? "Cuenta no encontrada"); return; }
      setSueldosAccount(data);
      setToAccountId(data.id);
    } catch {
      setSueldosError("Error de conexión");
    } finally {
      setSueldosSearching(false);
    }
  }

  // For transfer dest grouping (own accounts only)
  const nominaAccounts    = accounts.filter((a) => a.type === "nomina" && a.id !== accountId);
  const nonNominaAccounts = accounts.filter((a) => a.type !== "nomina" && a.id !== accountId);

  async function lookupExternal() {
    const addr = extAddress.trim().toLowerCase();
    if (!addr) return;
    setExtSearching(true);
    setExtError("");
    setExtAccount(null);
    try {
      const res = await fetch(`/api/accounts/lookup?address=${encodeURIComponent(addr)}`);
      const data = await res.json();
      if (!res.ok) { setExtError(data.error ?? "Cuenta no encontrada"); return; }
      setExtAccount(data);
      setToAccountId(data.id);
    } catch {
      setExtError("Error de conexión");
    } finally {
      setExtSearching(false);
    }
  }

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
        toAccountId:   showToAccount && toAccountId ? toAccountId : null,
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
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-slate-700">Cuenta destino *</label>
                  <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
                    <button
                      type="button"
                      onClick={() => { setDestMode("own"); setExtAccount(null); setExtError(""); if (!extAccount) setToAccountId(""); }}
                      className={cn("px-2.5 py-1 transition-colors", destMode === "own" ? "bg-[#1e3a5f] text-white" : "text-slate-500 hover:bg-slate-50")}
                    >
                      Mis cuentas
                    </button>
                    <button
                      type="button"
                      onClick={() => { setDestMode("external"); setToAccountId(extAccount?.id ?? ""); setTimeout(() => extInputRef.current?.focus(), 50); }}
                      className={cn("px-2.5 py-1 transition-colors", destMode === "external" ? "bg-[#1e3a5f] text-white" : "text-slate-500 hover:bg-slate-50")}
                    >
                      Dirección externa
                    </button>
                  </div>
                </div>

                {destMode === "own" ? (
                  <select
                    value={toAccountId}
                    onChange={(e) => setToAccountId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                    required={destMode === "own"}
                  >
                    <option value="">Selecciona destino...</option>
                    {nominaAccounts.filter((a) => a.id !== accountId).length > 0 && (
                      <optgroup label="👷 Cuentas de nómina">
                        {nominaAccounts
                          .filter((a) => a.id !== accountId)
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.icon || "👷"} {a.name} ({a.currency})
                            </option>
                          ))}
                      </optgroup>
                    )}
                    <optgroup label="Otras cuentas">
                      {nonNominaAccounts
                        .filter((a) => a.id !== accountId)
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.icon || "💰"} {a.name} ({a.currency})
                          </option>
                        ))}
                    </optgroup>
                  </select>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        ref={extInputRef}
                        type="text"
                        value={extAddress}
                        onChange={(e) => { setExtAddress(e.target.value); setExtAccount(null); setExtError(""); setToAccountId(""); }}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), lookupExternal())}
                        placeholder="uxuri-xxxxxxxx"
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                      />
                      <button
                        type="button"
                        onClick={lookupExternal}
                        disabled={!extAddress.trim() || extSearching}
                        className="px-3 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm disabled:opacity-40 hover:bg-[#1e3a5f]/90 transition-colors flex items-center gap-1.5"
                      >
                        {extSearching ? (
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                        ) : (
                          <Search className="w-4 h-4" />
                        )}
                        Buscar
                      </button>
                    </div>

                    {extError && (
                      <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        {extError}
                      </div>
                    )}

                    {extAccount && (
                      <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
                        <span className="text-2xl">{extAccount.icon || "💰"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{extAccount.name}</p>
                          <p className="text-xs text-slate-500">
                            {extAccount.currency}
                            {extAccount.ownerName ? ` · ${extAccount.ownerName}` : ""}
                            {extAccount.isOwn ? " · (tuya)" : ""}
                          </p>
                        </div>
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      </div>
                    )}

                    {!extAccount && !extError && (
                      <p className="text-xs text-slate-400">
                        Pide al destinatario su dirección <span className="font-mono">uxuri-xxxxxxxx</span> en Finanzas → Cuentas.
                      </p>
                    )}
                  </div>
                )}
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
                  onChange={(e) => { setCategory(e.target.value); if (e.target.value !== "Sueldos") setToAccountId(""); }}
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

          {/* Cuenta nómina — solo cuando egreso + Sueldos */}
          {type === "expense" && category === "Sueldos" && (
            <div className="rounded-xl border border-orange-100 bg-orange-50 p-3 space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                👷 Cuenta nómina destino
                <span className="ml-1.5 text-xs font-normal text-slate-400">opcional — para rastreo</span>
              </label>
              <div className="flex gap-2">
                <input
                  ref={sueldosInputRef}
                  type="text"
                  value={sueldosAddr}
                  onChange={(e) => { setSueldosAddr(e.target.value); setSueldosAccount(null); setSueldosError(""); setToAccountId(""); }}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), lookupSueldos())}
                  placeholder="uxuri-xxxxxxxx"
                  className="flex-1 px-3 py-2 border border-orange-200 bg-white rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
                <button
                  type="button"
                  onClick={lookupSueldos}
                  disabled={!sueldosAddr.trim() || sueldosSearching}
                  className="px-3 py-2 bg-orange-500 text-white rounded-lg text-sm disabled:opacity-40 hover:bg-orange-600 transition-colors flex items-center gap-1.5"
                >
                  {sueldosSearching
                    ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                    : <Search className="w-4 h-4" />}
                  Buscar
                </button>
              </div>

              {sueldosError && (
                <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {sueldosError}
                </div>
              )}

              {sueldosAccount && (
                <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
                  <span className="text-2xl">{sueldosAccount.icon || "👷"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{sueldosAccount.name}</p>
                    <p className="text-xs text-slate-500">
                      {sueldosAccount.currency}
                      {sueldosAccount.ownerName ? ` · ${sueldosAccount.ownerName}` : ""}
                      {sueldosAccount.isOwn ? " · (tuya)" : ""}
                    </p>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                </div>
              )}

              {!sueldosAccount && !sueldosError && (
                <p className="text-xs text-orange-600">
                  Pide al empleado su dirección <span className="font-mono font-semibold">uxuri-xxxxxxxx</span> en Finanzas → Cuentas.
                </p>
              )}
            </div>
          )}

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
