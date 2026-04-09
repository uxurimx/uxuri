"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PiggyBank, Coins, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

type GoalSummary = {
  id: string;
  name: string;
  targetAmount: string;
  currency: string;
  savedAmount: number;
  isCompleted: boolean;
  category: string;
  deadline: string | null;
};

const CURRENCY_SYMBOL: Record<string, string> = {
  MXN: "$", USD: "$", EUR: "€", BTC: "₿", ETH: "Ξ", USDT: "$", other: "",
};

function fmt(amount: number | string, currency: string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  const sym = CURRENCY_SYMBOL[currency] ?? "";
  if (["BTC", "ETH"].includes(currency)) return `${num.toFixed(4)} ${currency}`;
  return `${sym}${num.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${currency}`;
}

function pct(saved: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((saved / target) * 100));
}

export function SavingsGoalWidget({ objectiveId }: { objectiveId: string }) {
  const [goals, setGoals] = useState<GoalSummary[] | null>(null);

  useEffect(() => {
    fetch("/api/savings-goals")
      .then((r) => r.json())
      .then((all: GoalSummary[]) =>
        setGoals(all.filter((g) => (g as unknown as { objectiveId: string | null }).objectiveId === objectiveId))
      )
      .catch(() => setGoals([]));
  }, [objectiveId]);

  if (goals === null) return null; // loading silencioso
  if (goals.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <PiggyBank className="w-4 h-4 text-blue-500" />
            Ahorro vinculado
          </h3>
          <Link
            href="/finanzas/metas"
            className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" /> Gestionar
          </Link>
        </div>
        <p className="text-xs text-slate-400">
          Ninguna meta de ahorro vinculada a este objetivo.{" "}
          <Link href="/finanzas/metas" className="text-blue-500 hover:underline">
            Crear una
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <PiggyBank className="w-4 h-4 text-blue-500" />
          Ahorro vinculado
        </h3>
        <Link
          href="/finanzas/metas"
          className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
        >
          <ExternalLink className="w-3 h-3" /> Ver todas
        </Link>
      </div>

      {goals.map((g) => {
        const target = parseFloat(g.targetAmount);
        const progress = pct(g.savedAmount, target);
        const progressColor = g.isCompleted || progress >= 100
          ? "bg-emerald-500"
          : progress >= 75
          ? "bg-blue-500"
          : progress >= 40
          ? "bg-blue-400"
          : "bg-slate-300";

        return (
          <div key={g.id} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className={cn("text-sm font-medium", g.isCompleted && "line-through text-slate-400")}>
                {g.name}
              </span>
              <span className="text-xs font-semibold text-slate-600">{progress}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", progressColor)}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Coins className="w-3 h-3" />
                {fmt(g.savedAmount, g.currency)}
              </span>
              <span>meta: {fmt(target, g.currency)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
