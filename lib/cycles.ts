export type CyclePhase = "none" | "rest" | "approaching" | "review" | "overdue";

export interface CycleInfo {
  phase: CyclePhase;
  /** 0–200 (puede superar 100 si está vencido) */
  pct: number;
  /** Texto corto: "en 8h", "revisar ya", "2d vencido" */
  label: string;
  /** Tailwind class para la barra de progreso */
  barColor: string;
  /** Tailwind classes para el badge */
  badgeClass: string;
  /** Horas restantes al siguiente ciclo (null si vencido o sin ciclo) */
  hoursLeft: number | null;
}

export function getCycleInfo(
  cycleHours: number | null | undefined,
  lastCycleAt: Date | string | null | undefined,
  nextCycleAt: Date | string | null | undefined,
): CycleInfo {
  const none: CycleInfo = {
    phase: "none", pct: 0, label: "", barColor: "", badgeClass: "", hoursLeft: null,
  };
  if (!cycleHours || !nextCycleAt) return none;

  const now   = Date.now();
  const last  = lastCycleAt ? new Date(lastCycleAt).getTime() : now - cycleHours * 3_600_000;
  const next  = new Date(nextCycleAt).getTime();
  const total = cycleHours * 3_600_000;
  const pct   = Math.round(((now - last) / total) * 100);
  const msLeft = next - now;
  const hoursLeft = msLeft > 0 ? Math.ceil(msLeft / 3_600_000) : 0;

  if (pct < 33) return {
    phase: "rest", pct, hoursLeft, barColor: "bg-emerald-400", badgeClass: "bg-emerald-50 text-emerald-700",
    label: hoursLeft > 48 ? `en ${Math.ceil(hoursLeft / 24)}d` : `en ${hoursLeft}h`,
  };

  if (pct < 80) return {
    phase: "approaching", pct, hoursLeft, barColor: "bg-amber-400", badgeClass: "bg-amber-50 text-amber-700",
    label: hoursLeft > 0 ? `en ${hoursLeft}h` : "próximo",
  };

  if (pct <= 100) return {
    phase: "review", pct, hoursLeft: 0, barColor: "bg-orange-500", badgeClass: "bg-orange-50 text-orange-700",
    label: "revisar ya",
  };

  const overdueH = Math.floor((now - next) / 3_600_000);
  return {
    phase: "overdue", pct: Math.min(pct, 200), hoursLeft: null,
    barColor: "bg-red-300", badgeClass: "bg-red-50 text-red-500",
    label: overdueH >= 24 ? `${Math.floor(overdueH / 24)}d vencido` : `${overdueH}h vencido`,
  };
}

/** Calcula el nuevo momentum al marcar revisado */
export function calcMomentumOnReview(current: number, wasOverdue: boolean): number {
  const boost = wasOverdue ? 10 : 20;
  return Math.min(100, current + boost);
}

/** Calcula el decay de momentum por ciclo saltado */
export function calcMomentumDecay(current: number): number {
  return Math.max(0, current - 15);
}
