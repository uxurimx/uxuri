"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PiggyBank, Plus, Target, Pencil, Trash2, Check, X, CalendarDays, ChevronDown, ChevronUp, Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { FinanceSubnav } from "./finance-dashboard";

// ── Types ──────────────────────────────────────────────────────────────────────

type GoalCategory = "viaje" | "compra" | "emergencia" | "inversion" | "educacion" | "salud" | "hogar" | "otro";

export type SavingsGoalWithSaved = {
  id: string;
  userId: string;
  businessId: string | null;
  name: string;
  description: string | null;
  targetAmount: string;
  currency: string;
  category: GoalCategory;
  deadline: string | null;
  objectiveId: string | null;
  isCompleted: boolean;
  notes: string | null;
  savedAmount: number;
  createdAt: string;
  updatedAt: string;
};

type Contribution = {
  id: string;
  goalId: string;
  amount: string;
  date: string;
  note: string | null;
  createdAt: string;
};

type ObjectiveOption = { id: string; title: string };

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<GoalCategory, { label: string; emoji: string }> = {
  viaje:      { label: "Viaje",      emoji: "✈️" },
  compra:     { label: "Compra",     emoji: "🛍️" },
  emergencia: { label: "Emergencia", emoji: "🚨" },
  inversion:  { label: "Inversión",  emoji: "📈" },
  educacion:  { label: "Educación",  emoji: "🎓" },
  salud:      { label: "Salud",      emoji: "🏥" },
  hogar:      { label: "Hogar",      emoji: "🏠" },
  otro:       { label: "Otro",       emoji: "🎯" },
};

const CURRENCIES = ["MXN", "USD", "EUR", "BTC", "ETH", "USDT", "other"] as const;
const CURRENCY_SYMBOL: Record<string, string> = {
  MXN: "$", USD: "$", EUR: "€", BTC: "₿", ETH: "Ξ", USDT: "$", other: "",
};

function fmt(amount: number | string, currency: string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  const sym = CURRENCY_SYMBOL[currency] ?? "";
  if (["BTC", "ETH"].includes(currency)) return `${num.toFixed(6)} ${currency}`;
  return `${sym}${num.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function pct(saved: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((saved / target) * 100));
}

function daysLeft(deadline: string): number {
  const diff = new Date(deadline).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ── Goal Form ─────────────────────────────────────────────────────────────────

function GoalForm({
  initial,
  objectives,
  onSave,
  onCancel,
}: {
  initial?: Partial<SavingsGoalWithSaved>;
  objectives: ObjectiveOption[];
  onSave: (data: Partial<SavingsGoalWithSaved>) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [targetAmount, setTargetAmount] = useState(
    initial?.targetAmount ? parseFloat(initial.targetAmount).toString() : ""
  );
  const [currency, setCurrency] = useState<string>(initial?.currency ?? "MXN");
  const [category, setCategory] = useState<GoalCategory>(initial?.category ?? "otro");
  const [deadline, setDeadline] = useState(initial?.deadline ?? "");
  const [objectiveId, setObjectiveId] = useState(initial?.objectiveId ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !targetAmount) return;
    setSaving(true);
    await onSave({
      name: name.trim(),
      description: description.trim() || null,
      targetAmount,
      currency,
      category,
      deadline: deadline || null,
      objectiveId: objectiveId || null,
      notes: notes.trim() || null,
    });
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Viaje a Cancún"
            required
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Meta *</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
            placeholder="0.00"
            required
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Moneda</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Categoría</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as GoalCategory)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Object.entries(CATEGORY_CONFIG).map(([val, { label, emoji }]) => (
              <option key={val} value={val}>{emoji} {label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Fecha límite</label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {objectives.length > 0 && (
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Vincular a objetivo (opcional)</label>
            <select
              value={objectiveId}
              onChange={(e) => setObjectiveId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Sin vínculo —</option>
              {objectives.map((o) => (
                <option key={o.id} value={o.id}>{o.title}</option>
              ))}
            </select>
          </div>
        )}

        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="¿Para qué es este ahorro?"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving || !name.trim() || !targetAmount}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Guardando…" : initial?.id ? "Guardar" : "Crear meta"}
        </button>
      </div>
    </form>
  );
}

// ── Contribute Modal ──────────────────────────────────────────────────────────

function ContributeModal({
  goal,
  onClose,
  onSuccess,
}: {
  goal: SavingsGoalWithSaved;
  onClose: () => void;
  onSuccess: (amount: number) => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount) return;
    setSaving(true);
    const res = await fetch(`/api/savings-goals/${goal.id}/contribute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: parseFloat(amount), date, note: note.trim() || undefined }),
    });
    setSaving(false);
    if (res.ok) {
      onSuccess(parseFloat(amount));
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">Abonar a meta</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-4">{goal.name}</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Monto ({goal.currency})</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
              autoFocus
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fecha</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nota (opcional)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Depósito quincenal, etc."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !amount}
              className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Guardando…" : "Abonar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Goal Card ─────────────────────────────────────────────────────────────────

function GoalCard({
  goal,
  objectives,
  onUpdate,
  onDelete,
}: {
  goal: SavingsGoalWithSaved;
  objectives: ObjectiveOption[];
  onUpdate: (updated: SavingsGoalWithSaved) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [contributing, setContributing] = useState(false);
  const [showContribs, setShowContribs] = useState(false);
  const [contributions, setContributions] = useState<Contribution[] | null>(null);
  const [loadingContribs, setLoadingContribs] = useState(false);
  const router = useRouter();

  const target = parseFloat(goal.targetAmount);
  const saved = goal.savedAmount;
  const progress = pct(saved, target);
  const remaining = Math.max(0, target - saved);
  const catConfig = CATEGORY_CONFIG[goal.category] ?? CATEGORY_CONFIG.otro;

  const progressColor = goal.isCompleted
    ? "bg-emerald-500"
    : progress >= 100
    ? "bg-emerald-500"
    : progress >= 75
    ? "bg-blue-500"
    : progress >= 40
    ? "bg-blue-400"
    : "bg-slate-300";

  async function toggleContribs() {
    if (showContribs) { setShowContribs(false); return; }
    setShowContribs(true);
    if (contributions !== null) return;
    setLoadingContribs(true);
    const res = await fetch(`/api/savings-goals/${goal.id}/contribute`);
    const data = await res.json();
    setContributions(data);
    setLoadingContribs(false);
  }

  async function handleMarkComplete() {
    const res = await fetch(`/api/savings-goals/${goal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isCompleted: !goal.isCompleted }),
    });
    if (res.ok) {
      onUpdate({ ...goal, isCompleted: !goal.isCompleted });
    }
  }

  async function handleEdit(data: Partial<SavingsGoalWithSaved>) {
    const res = await fetch(`/api/savings-goals/${goal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        targetAmount: data.targetAmount ? parseFloat(data.targetAmount) : undefined,
      }),
    });
    if (res.ok) {
      onUpdate({ ...goal, ...data });
      setEditing(false);
      router.refresh();
    }
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar la meta "${goal.name}"? Se perderán todos los abonos.`)) return;
    await fetch(`/api/savings-goals/${goal.id}`, { method: "DELETE" });
    onDelete(goal.id);
  }

  function handleContributed(amount: number) {
    onUpdate({ ...goal, savedAmount: saved + amount });
    if (contributions !== null) {
      const today = new Date().toISOString().split("T")[0];
      setContributions([...contributions, {
        id: crypto.randomUUID(),
        goalId: goal.id,
        amount: amount.toString(),
        date: today,
        note: null,
        createdAt: new Date().toISOString(),
      }]);
    }
  }

  const linkedObj = objectives.find((o) => o.id === goal.objectiveId);

  return (
    <div className={cn(
      "bg-white rounded-2xl border p-5 flex flex-col gap-4 transition-all",
      goal.isCompleted ? "border-emerald-200 opacity-70" : "border-slate-200 hover:border-slate-300"
    )}>
      {editing ? (
        <GoalForm
          initial={goal}
          objectives={objectives}
          onSave={handleEdit}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-2xl">{catConfig.emoji}</span>
              <div className="min-w-0">
                <h3 className={cn("font-semibold text-slate-900 truncate", goal.isCompleted && "line-through text-slate-500")}>
                  {goal.name}
                </h3>
                <span className="text-xs text-slate-400">{catConfig.label}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleMarkComplete}
                title={goal.isCompleted ? "Reabrir" : "Marcar completada"}
                className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  goal.isCompleted
                    ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                    : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                )}
              >
                <Check className="w-4 h-4" />
              </button>
              <button onClick={() => setEditing(true)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={handleDelete} className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Description */}
          {goal.description && (
            <p className="text-sm text-slate-500">{goal.description}</p>
          )}

          {/* Progress */}
          <div className="space-y-1.5">
            <div className="flex items-end justify-between">
              <div>
                <span className="text-lg font-bold text-slate-900">{fmt(saved, goal.currency)}</span>
                <span className="text-sm text-slate-400 ml-1">/ {fmt(target, goal.currency)}</span>
              </div>
              <span className={cn(
                "text-sm font-semibold",
                progress >= 100 ? "text-emerald-600" : "text-slate-600"
              )}>
                {progress}%
              </span>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", progressColor)}
                style={{ width: `${progress}%` }}
              />
            </div>
            {!goal.isCompleted && progress < 100 && (
              <p className="text-xs text-slate-400">Faltan {fmt(remaining, goal.currency)}</p>
            )}
          </div>

          {/* Meta + Deadline row */}
          <div className="flex flex-wrap gap-3 text-xs text-slate-500">
            {goal.deadline && (() => {
              const days = daysLeft(goal.deadline);
              return (
                <span className={cn(
                  "flex items-center gap-1",
                  days < 0 ? "text-red-500" : days <= 30 ? "text-amber-600" : "text-slate-500"
                )}>
                  <CalendarDays className="w-3.5 h-3.5" />
                  {days < 0
                    ? `Vencida hace ${Math.abs(days)}d`
                    : days === 0
                    ? "Vence hoy"
                    : `${days}d restantes`}
                </span>
              );
            })()}
            {linkedObj && (
              <a
                href={`/objectives/${goal.objectiveId}`}
                className="flex items-center gap-1 text-blue-500 hover:text-blue-700 transition-colors"
              >
                <Target className="w-3.5 h-3.5" />
                {linkedObj.title}
              </a>
            )}
          </div>

          {/* Actions */}
          {!goal.isCompleted && (
            <div className="flex gap-2">
              <button
                onClick={() => setContributing(true)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-colors"
              >
                <Coins className="w-4 h-4" />
                Abonar
              </button>
              <button
                onClick={toggleContribs}
                className="flex items-center gap-1 px-3 py-2 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-50 text-sm transition-colors"
              >
                Historial
                {showContribs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}

          {/* Contributions history */}
          {showContribs && (
            <div className="border-t border-slate-100 pt-3 space-y-1.5">
              {loadingContribs ? (
                <p className="text-xs text-slate-400 text-center py-2">Cargando…</p>
              ) : contributions && contributions.length > 0 ? (
                contributions.map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 text-xs">{c.date}</span>
                    <span className="font-medium text-emerald-700">+{fmt(c.amount, goal.currency)}</span>
                    {c.note && <span className="text-xs text-slate-400 truncate max-w-[120px]">{c.note}</span>}
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 text-center py-2">Sin abonos aún</p>
              )}
            </div>
          )}
        </>
      )}

      {contributing && (
        <ContributeModal
          goal={goal}
          onClose={() => setContributing(false)}
          onSuccess={handleContributed}
        />
      )}
    </div>
  );
}

// ── Summary Bar ───────────────────────────────────────────────────────────────

function SummaryBar({ goals }: { goals: SavingsGoalWithSaved[] }) {
  const active = goals.filter((g) => !g.isCompleted);
  const completed = goals.filter((g) => g.isCompleted);
  const totalTarget = active.reduce((s, g) => s + parseFloat(g.targetAmount), 0);
  const totalSaved = active.reduce((s, g) => s + g.savedAmount, 0);
  const overallPct = pct(totalSaved, totalTarget);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: "Metas activas", value: active.length, sub: null, color: "text-slate-900" },
        { label: "Completadas", value: completed.length, sub: null, color: "text-emerald-700" },
        { label: "Total ahorrado (MXN activas)", value: `$${totalSaved.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`, sub: null, color: "text-blue-700" },
        { label: "Progreso global", value: `${overallPct}%`, sub: `de $${totalTarget.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`, color: overallPct >= 75 ? "text-emerald-700" : "text-slate-700" },
      ].map((stat) => (
        <div key={stat.label} className="bg-white rounded-xl border border-slate-200 px-4 py-3">
          <p className="text-xs text-slate-500">{stat.label}</p>
          <p className={cn("text-xl font-bold mt-0.5", stat.color)}>{stat.value}</p>
          {stat.sub && <p className="text-xs text-slate-400 mt-0.5">{stat.sub}</p>}
        </div>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function SavingsGoalsList({
  initialGoals,
  objectives,
}: {
  initialGoals: SavingsGoalWithSaved[];
  objectives: ObjectiveOption[];
}) {
  const [goals, setGoals] = useState<SavingsGoalWithSaved[]>(initialGoals);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("active");
  const router = useRouter();

  async function handleCreate(data: Partial<SavingsGoalWithSaved>) {
    const res = await fetch("/api/savings-goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        targetAmount: data.targetAmount ? parseFloat(data.targetAmount) : 0,
      }),
    });
    if (res.ok) {
      const newGoal = await res.json();
      setGoals((prev) => [newGoal, ...prev]);
      setShowForm(false);
      router.refresh();
    }
  }

  function handleUpdate(updated: SavingsGoalWithSaved) {
    setGoals((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
  }

  function handleDelete(id: string) {
    setGoals((prev) => prev.filter((g) => g.id !== id));
  }

  const visible = goals.filter((g) =>
    filter === "all" ? true : filter === "active" ? !g.isCompleted : g.isCompleted
  );

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Subnav */}
      <FinanceSubnav active="/finanzas/metas" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PiggyBank className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl font-bold text-slate-900">Metas de ahorro</h1>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva meta
        </button>
      </div>

      {/* New goal form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-blue-200 p-5 shadow-sm">
          <h3 className="font-medium text-slate-900 mb-4">Nueva meta de ahorro</h3>
          <GoalForm
            objectives={objectives}
            onSave={handleCreate}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Stats */}
      {goals.length > 0 && <SummaryBar goals={goals} />}

      {/* Filter tabs */}
      {goals.length > 0 && (
        <div className="flex gap-1 bg-slate-50 rounded-xl p-1 w-fit">
          {(["active", "all", "completed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
                filter === f ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {f === "active" ? "Activas" : f === "completed" ? "Completadas" : "Todas"}
            </button>
          ))}
        </div>
      )}

      {/* Goals grid */}
      {visible.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <PiggyBank className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {goals.length === 0
              ? "Crea tu primera meta de ahorro"
              : "Sin metas en esta categoría"}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              objectives={objectives}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
