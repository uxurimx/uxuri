/**
 * Utilería de fechas que respeta la zona horaria de la app.
 * Todas las páginas/APIs deben usar estas funciones en lugar de
 * `new Date().toISOString().split("T")[0]` (que devuelve UTC).
 *
 * Configura APP_TIMEZONE en .env.local (ej: America/Mexico_City).
 * Si no está definido, usa la zona del servidor.
 */

const APP_TIMEZONE = process.env.APP_TIMEZONE ?? undefined;

/** "YYYY-MM-DD" en la zona horaria de la app. */
export function todayStr(): string {
  return localDateStr(new Date());
}

/** Convierte cualquier Date a "YYYY-MM-DD" en la zona horaria de la app. */
export function localDateStr(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** "YYYY-MM-DD" de hace `n` días en la zona horaria de la app. */
export function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDateStr(d);
}

/**
 * Inicio del día de hoy como Date (internamente UTC).
 * Necesario para comparar con columnas timestamp en DB.
 */
export function startOfLocalDay(offsetDays = 0): Date {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  }).formatToParts(now);

  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  const h = parseInt(p.hour) % 24; // "24" → 0 (medianoche)
  const m = parseInt(p.minute);
  const s = parseInt(p.second);

  // Resta el tiempo local transcurrido desde medianoche + milisegundos
  const midnight = new Date(now.getTime() - (h * 3600 + m * 60 + s) * 1000 - now.getMilliseconds());

  if (offsetDays) midnight.setDate(midnight.getDate() + offsetDays);
  return midnight;
}

/** Fin del día de hoy como Date (23:59:59.999 local). */
export function endOfLocalDay(): Date {
  return new Date(startOfLocalDay().getTime() + 24 * 3600 * 1000 - 1);
}

/**
 * Inicio del lunes de la semana actual como Date.
 * Semana lunes→domingo (ISO).
 */
export function startOfLocalWeek(): Date {
  const now = new Date();
  const localDay = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    weekday: "short",
  }).format(now); // "Mon", "Tue", ...

  const dayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(localDay);
  const daysFromMon = dayIndex === 0 ? 6 : dayIndex - 1;

  return startOfLocalDay(-daysFromMon);
}
