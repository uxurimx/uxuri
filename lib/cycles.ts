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
  /** Minutos restantes al siguiente ciclo (null si vencido o sin ciclo) */
  minutesLeft: number | null;
}

/** Formatea minutos como "5m", "2h", "3d 4h", etc. */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h < 24) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
}

export function getCycleInfo(
  cycleMinutes: number | null | undefined,
  lastCycleAt: Date | string | null | undefined,
  nextCycleAt: Date | string | null | undefined,
): CycleInfo {
  const none: CycleInfo = {
    phase: "none", pct: 0, label: "", barColor: "", badgeClass: "", minutesLeft: null,
  };
  if (!cycleMinutes || !nextCycleAt) return none;

  const now      = Date.now();
  const last     = lastCycleAt ? new Date(lastCycleAt).getTime() : now - cycleMinutes * 60_000;
  const next     = new Date(nextCycleAt).getTime();
  const total    = cycleMinutes * 60_000;
  const pct      = Math.round(((now - last) / total) * 100);
  const msLeft   = next - now;
  const minLeft  = msLeft > 0 ? Math.ceil(msLeft / 60_000) : 0;

  if (pct < 33) return {
    phase: "rest", pct, minutesLeft: minLeft,
    barColor: "bg-emerald-400", badgeClass: "bg-emerald-50 text-emerald-700",
    label: `en ${formatDuration(minLeft)}`,
  };

  if (pct < 80) return {
    phase: "approaching", pct, minutesLeft: minLeft,
    barColor: "bg-amber-400", badgeClass: "bg-amber-50 text-amber-700",
    label: minLeft > 0 ? `en ${formatDuration(minLeft)}` : "próximo",
  };

  if (pct <= 100) return {
    phase: "review", pct, minutesLeft: 0,
    barColor: "bg-orange-500", badgeClass: "bg-orange-50 text-orange-700",
    label: "revisar ya",
  };

  const overdueMin = Math.floor((now - next) / 60_000);
  return {
    phase: "overdue", pct: Math.min(pct, 200), minutesLeft: null,
    barColor: "bg-red-300", badgeClass: "bg-red-50 text-red-500",
    label: `${formatDuration(overdueMin)} vencido`,
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
