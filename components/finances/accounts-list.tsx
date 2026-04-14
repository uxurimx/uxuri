"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Plus, Pencil, Trash2, X, Wallet, TrendingUp,
  CreditCard, Building2, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AccountRow = {
  id: string;
  userId: string;
  businessId: string | null;
  name: string;
  type: "cash" | "bank" | "credit" | "stripe" | "paypal" | "crypto" | "other";
  currency: "MXN" | "USD" | "EUR" | "BTC" | "ETH" | "USDT" | "other";
  initialBalance: string;
  icon: string | null;
  color: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type BusinessOption = {
  id: string;
  name: string;
  logo: string | null;
  color: string | null;
};

// ── Config ────────────────────────────────────────────────────────────────────

const typeConfig: Record<AccountRow["type"], { label: string; defaultIcon: string; className: string }> = {
  cash:    { label: "Efectivo",    defaultIcon: "💵", className: "bg-emerald-50 text-emerald-700" },
  bank:    { label: "Banco",       defaultIcon: "🏦", className: "bg-blue-50 text-blue-700" },
  credit:  { label: "Crédito",     defaultIcon: "💳", className: "bg-violet-50 text-violet-700" },
  stripe:  { label: "Stripe",      defaultIcon: "⚡", className: "bg-indigo-50 text-indigo-700" },
  paypal:  { label: "PayPal",      defaultIcon: "🅿",  className: "bg-sky-50 text-sky-700" },
  crypto:  { label: "Cripto",      defaultIcon: "₿",  className: "bg-amber-50 text-amber-700" },
  other:   { label: "Otro",        defaultIcon: "💰", className: "bg-slate-100 text-slate-600" },
};

const currencySymbol: Record<AccountRow["currency"], string> = {
  MXN: "$", USD: "$", EUR: "€", BTC: "₿", ETH: "Ξ", USDT: "$", other: "",
};

const ICONS = ["💵", "🏦", "💳", "⚡", "🅿", "₿", "Ξ", "💰", "🏠", "🚀", "💼", "🎯", "🔐", "🌐", "💹", "🪙"];
const COLORS = [
  { value: "#1e3a5f", label: "Azul" },
  { value: "#059669", label: "Verde" },
  { value: "#7c3aed", label: "Violeta" },
  { value: "#d97706", label: "Ámbar" },
  { value: "#dc2626", label: "Rojo" },
  { value: "#0891b2", label: "Cian" },
  { value: "#be185d", label: "Rosa" },
  { value: "#374151", label: "Gris" },
  { value: "#9333ea", label: "Púrpura" },
  { value: "#0d9488", label: "Verde azulado" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBalance(amount: string | number, currency: AccountRow["currency"]): string {
  const num = parseFloat(amount.toString());
  const sym = currencySymbol[currency];
  if (["BTC", "ETH"].includes(currency)) {
    return `${num.toFixed(6)} ${currency}`;
  }
  if (currency === "other") {
    return num.toLocaleString("es-MX", { minimumFractionDigits: 2 });
  }
  return `${sym}${num.toLocaleString("es-MX", { minimumFractionDigits: 2 })} ${currency}`;
}

function groupByCurrency(accs: AccountRow[], computedBalances: Record<string, number>) {
  const totals: Record<string, number> = {};
  for (const a of accs) {
    if (!a.isActive) continue;
    const key = a.currency;
    const balance = computedBalances[a.id] ?? parseFloat(a.initialBalance ?? "0");
    totals[key] = (totals[key] ?? 0) + balance;
  }
  return totals;
}

// ── Account Card ──────────────────────────────────────────────────────────────

function AccountCard({
  account,
  business,
  computedBalance,
  isOwner,
  onEdit,
  onDelete,
}: {
  account: AccountRow;
  business?: BusinessOption;
  computedBalance?: number;
  isOwner: boolean;
  onEdit: (a: AccountRow) => void;
  onDelete: (id: string) => void;
}) {
  const typeCfg = typeConfig[account.type];
  const icon = account.icon || typeCfg.defaultIcon;
  const color = account.color || "#1e3a5f";
  const balance = computedBalance ?? parseFloat(account.initialBalance ?? "0");
  const isNegative = balance < 0;

  return (
    <div
      className={cn(
        "group relative bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all p-5 flex flex-col gap-3",
        account.isActive ? "border-slate-100" : "border-slate-100 opacity-60"
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
          style={{ backgroundColor: color + "22" }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 truncate">{account.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", typeCfg.className)}>
              {typeCfg.label}
            </span>
            <span className="text-xs text-slate-400">{account.currency}</span>
            {!account.isActive && (
              <span className="text-xs text-slate-400 bg-slate-50 px-1.5 rounded-full">Inactiva</span>
            )}
          </div>
        </div>
        {/* Actions */}
        {isOwner && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit(account)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(account.id)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Balance */}
      <div className="pt-1">
        <p className="text-xs text-slate-400 mb-0.5">Saldo</p>
        <p className={cn("text-2xl font-bold tabular-nums", isNegative ? "text-red-500" : "text-slate-900")}>
          {formatBalance(balance, account.currency)}
        </p>
      </div>

      {/* Footer: business or personal */}
      <div className="flex items-center gap-1.5 pt-1 border-t border-slate-50">
        {business ? (
          <>
            <span className="text-lg">{business.logo || "🏢"}</span>
            <span className="text-xs text-slate-500">{business.name}</span>
          </>
        ) : (
          <>
            <Wallet className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-400">Personal</span>
          </>
        )}
        {account.notes && (
          <span className="text-xs text-slate-400 ml-auto truncate max-w-[120px]">{account.notes}</span>
        )}
      </div>
    </div>
  );
}

// ── Account Modal ─────────────────────────────────────────────────────────────

function AccountModal({
  account,
  businesses,
  onClose,
  onSaved,
}: {
  account: AccountRow | null;
  businesses: BusinessOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!account;

  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState<AccountRow["type"]>(account?.type ?? "bank");
  const [currency, setCurrency] = useState<AccountRow["currency"]>(account?.currency ?? "MXN");
  const [initialBalance, setInitialBalance] = useState(
    account ? parseFloat(account.initialBalance ?? "0").toString() : "0"
  );
  const [icon, setIcon] = useState(account?.icon ?? "🏦");
  const [color, setColor] = useState(account?.color ?? "#1e3a5f");
  const [notes, setNotes] = useState(account?.notes ?? "");
  const [isActive, setIsActive] = useState(account?.isActive ?? true);
  const [businessId, setBusinessId] = useState(account?.businessId ?? "");
  const [saving, setSaving] = useState(false);

  // Auto-set icon when type changes (only if user hasn't customized)
  function handleTypeChange(t: AccountRow["type"]) {
    setType(t);
    if (ICONS.includes(typeConfig[t].defaultIcon)) {
      setIcon(typeConfig[t].defaultIcon);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        type,
        currency,
        initialBalance: parseFloat(initialBalance) || 0,
        icon,
        color,
        notes: notes.trim() || null,
        isActive,
        businessId: businessId || null,
      };
      const res = isEdit
        ? await fetch(`/api/accounts/${account!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/accounts", {
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
            {isEdit ? "Editar cuenta" : "Nueva cuenta"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Icon + Color row */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Ícono</label>
              <div className="flex flex-wrap gap-1.5">
                {ICONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setIcon(ic)}
                    className={cn(
                      "w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-colors",
                      icon === ic ? "bg-[#1e3a5f]/10 ring-2 ring-[#1e3a5f]" : "hover:bg-slate-50"
                    )}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Color</label>
              <div className="grid grid-cols-2 gap-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    title={c.label}
                    className={cn(
                      "w-6 h-6 rounded-full transition-transform",
                      color === c.value ? "scale-125 ring-2 ring-offset-1 ring-slate-400" : "hover:scale-110"
                    )}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
              {/* Preview */}
              <div
                className="mt-2 w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{ backgroundColor: color + "22" }}
              >
                {icon}
              </div>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: BBVA Nómina, Efectivo casa, Stripe USD..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
              required
            />
          </div>

          {/* Type + Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
              <select
                value={type}
                onChange={(e) => handleTypeChange(e.target.value as AccountRow["type"])}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
              >
                <option value="cash">💵 Efectivo</option>
                <option value="bank">🏦 Banco</option>
                <option value="credit">💳 Crédito</option>
                <option value="stripe">⚡ Stripe</option>
                <option value="paypal">🅿 PayPal</option>
                <option value="crypto">₿ Cripto</option>
                <option value="other">💰 Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Moneda</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as AccountRow["currency"])}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
              >
                <option value="MXN">🇲🇽 MXN</option>
                <option value="USD">🇺🇸 USD</option>
                <option value="EUR">🇪🇺 EUR</option>
                <option value="BTC">₿ BTC</option>
                <option value="ETH">Ξ ETH</option>
                <option value="USDT">💲 USDT</option>
                <option value="other">Otra</option>
              </select>
            </div>
          </div>

          {/* Initial balance */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Saldo inicial{" "}
              <span className="text-xs font-normal text-slate-400">
                (saldo actual antes de empezar a registrar)
              </span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                {currencySymbol[currency]}
              </span>
              <input
                type="number"
                step="any"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
              />
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
                  <option key={b.id} value={b.id}>
                    {b.logo || "🏢"} {b.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">
                Las cuentas de negocio son visibles para todos los miembros del negocio.
              </p>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notas</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: CLABE, últimos 4 dígitos..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
            />
          </div>

          {/* Active toggle */}
          {isEdit && (
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setIsActive((v) => !v)}
                className={cn(
                  "relative w-10 h-5 rounded-full transition-colors",
                  isActive ? "bg-[#1e3a5f]" : "bg-slate-200"
                )}
              >
                <div
                  className={cn(
                    "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                    isActive ? "translate-x-5" : "translate-x-0.5"
                  )}
                />
              </div>
              <span className="text-sm text-slate-700">Cuenta activa</span>
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
              disabled={saving || !name.trim()}
              className="flex-1 px-4 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#162d4a] transition-colors disabled:opacity-50"
            >
              {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear cuenta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Sub-nav ───────────────────────────────────────────────────────────────────

const SUBNAV = [
  { href: "/finanzas",               label: "Resumen",       available: true },
  { href: "/finanzas/cuentas",       label: "Cuentas",       available: true },
  { href: "/finanzas/transacciones", label: "Transacciones", available: true },
  { href: "/finanzas/pagos",         label: "Pagos",         available: true },
  { href: "/finanzas/presupuesto",   label: "Presupuesto",   available: false },
];

// ── Main Component ────────────────────────────────────────────────────────────

export function AccountsList({
  initialAccounts,
  businesses,
  currentUserId,
  computedBalances = {},
}: {
  initialAccounts: AccountRow[];
  businesses: BusinessOption[];
  currentUserId: string;
  computedBalances?: Record<string, number>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [accountList, setAccountList] = useState(initialAccounts);
  // Sync when router.refresh() delivers new server data
  useEffect(() => { setAccountList(initialAccounts); }, [initialAccounts]);
  const [modal, setModal] = useState<AccountRow | null | undefined>(undefined);
  // undefined=closed, null=create, AccountRow=edit

  function openCreate() { setModal(null); }
  function openEdit(a: AccountRow) { setModal(a); }
  function closeModal() { setModal(undefined); }

  function handleSaved() {
    closeModal();
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta cuenta?")) return;
    await fetch(`/api/accounts/${id}`, { method: "DELETE" });
    setAccountList((prev) => prev.filter((a) => a.id !== id));
  }

  // Summary: totals per currency (active accounts only)
  const totals = groupByCurrency(accountList, computedBalances);
  const totalEntries = Object.entries(totals);

  const activeCount = accountList.filter((a) => a.isActive).length;

  // Group accounts: personal first, then by business
  const personal = accountList.filter((a) => !a.businessId);
  const byBusiness: Record<string, AccountRow[]> = {};
  for (const a of accountList.filter((a) => a.businessId)) {
    byBusiness[a.businessId!] = [...(byBusiness[a.businessId!] ?? []), a];
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Finanzas</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {activeCount} cuenta{activeCount !== 1 ? "s" : ""} activa{activeCount !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-[#1e3a5f] text-white rounded-xl text-sm font-medium hover:bg-[#162d4a] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva cuenta
        </button>
      </div>

      {/* Sub-nav */}
      <div className="flex gap-1 bg-slate-50 rounded-xl p-1 w-fit">
        {SUBNAV.map((item) => (
          <button
            key={item.href}
            disabled={!item.available}
            onClick={() => item.available && router.push(item.href)}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
              pathname === item.href && item.available
                ? "bg-white text-slate-900 shadow-sm"
                : item.available
                ? "text-slate-500 hover:text-slate-700"
                : "text-slate-300 cursor-not-allowed"
            )}
          >
            {item.label}
            {!item.available && (
              <span className="ml-1.5 text-[10px] text-slate-300">pronto</span>
            )}
          </button>
        ))}
      </div>

      {/* Balance summary */}
      {totalEntries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {totalEntries.map(([currency, total]) => {
            const isNeg = total < 0;
            return (
              <div key={currency} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                <p className="text-xs text-slate-400 mb-1">Total {currency}</p>
                <p className={cn("text-xl font-bold tabular-nums", isNeg ? "text-red-500" : "text-slate-900")}>
                  {formatBalance(total, currency as AccountRow["currency"])}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {accountList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Wallet className="w-12 h-12 text-slate-200 mb-4" />
          <p className="text-slate-500 font-medium">Sin cuentas todavía</p>
          <p className="text-slate-400 text-sm mt-1">
            Registra tus cuentas bancarias, efectivo, Stripe, PayPal o cripto
          </p>
          <button
            onClick={openCreate}
            className="mt-4 px-4 py-2 bg-[#1e3a5f] text-white rounded-xl text-sm font-medium hover:bg-[#162d4a] transition-colors"
          >
            Crear primera cuenta
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Personal accounts */}
          {personal.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Wallet className="w-4 h-4 text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-600">Personal</h2>
                <span className="text-xs text-slate-400">({personal.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {personal.map((a) => (
                  <AccountCard
                    key={a.id}
                    account={a}
                    computedBalance={computedBalances[a.id]}
                    isOwner={a.userId === currentUserId}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Business accounts grouped */}
          {Object.entries(byBusiness).map(([bizId, bizAccounts]) => {
            const biz = businesses.find((b) => b.id === bizId);
            return (
              <section key={bizId}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{biz?.logo || "🏢"}</span>
                  <h2 className="text-sm font-semibold text-slate-600">{biz?.name ?? "Negocio"}</h2>
                  <span className="text-xs text-slate-400">({bizAccounts.length})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {bizAccounts.map((a) => (
                    <AccountCard
                      key={a.id}
                      account={a}
                      business={biz}
                      computedBalance={computedBalances[a.id]}
                      isOwner={a.userId === currentUserId}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modal !== undefined && (
        <AccountModal
          account={modal}
          businesses={businesses}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
