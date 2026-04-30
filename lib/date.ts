/**
 * Utilería de fechas que respeta la zona horaria local del servidor.
 * Usa APP_TIMEZONE del entorno si está definido; si no, usa el timezone del sistema.
 *
 * IMPORTANTE: Lee el env var dentro de cada función (no a nivel de módulo)
 * para evitar problemas de caché de módulo en Next.js dev mode.
 */

function tz(): string | undefined {
  return process.env.APP_TIMEZONE || undefined;
}

/** "YYYY-MM-DD" en la zona horaria local (APP_TIMEZONE o sistema). */
export function todayStr(): string {
  return localDateStr(new Date());
}

/** Convierte cualquier Date a "YYYY-MM-DD" en la zona horaria local. */
export function localDateStr(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** "YYYY-MM-DD" de hace `n` días en la zona horaria local. */
export function daysAgoStr(n: number): string {
  // Parte desde la fecha local de hoy (no UTC), luego resta días
  const todayLocal = todayStr(); // "2026-04-29"
  const d = new Date(todayLocal + "T12:00:00"); // noon local → safe para aritmética
  d.setDate(d.getDate() - n);
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz() }).format(d);
}

/**
 * Inicio del día de hoy como Date en UTC.
 * Necesario para comparar con columnas timestamp en DB.
 * offsetDays: -1 = ayer, -7 = hace una semana, etc.
 */
export function startOfLocalDay(offsetDays = 0): Date {
  const now = new Date();

  // Hora actual en la zona horaria local
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz(),
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  }).formatToParts(now);

  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  const h = parseInt(p.hour) % 24; // "24" → 0 en medianoche exacta
  const m = parseInt(p.minute);
  const s = parseInt(p.second);

  // Resta tiempo transcurrido desde medianoche local → da medianoche de hoy en UTC
  const midnight = new Date(
    now.getTime() - (h * 3600 + m * 60 + s) * 1000 - now.getMilliseconds()
  );

  if (offsetDays !== 0) {
    midnight.setTime(midnight.getTime() + offsetDays * 24 * 3600 * 1000);
  }
  return midnight;
}

/** Inicio del lunes de esta semana como Date (semana ISO: lun→dom). */
export function startOfLocalWeek(): Date {
  const localDay = new Intl.DateTimeFormat("en-US", {
    timeZone: tz(),
    weekday: "short",
  }).format(new Date()); // "Mon", "Tue", ...

  const dayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(localDay);
  const daysFromMon = dayIndex === 0 ? 6 : dayIndex - 1;

  return startOfLocalDay(-daysFromMon);
}
