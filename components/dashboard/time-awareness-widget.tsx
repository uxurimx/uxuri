"use client";

import { Clock } from "lucide-react";

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function motivationalMessage(yearPct: number): string {
  if (yearPct < 10) return "El año acaba de comenzar. Mucho tiempo por delante.";
  if (yearPct < 25) return "Primer trimestre. Buen momento para arrancar fuerte.";
  if (yearPct < 50) return "A mitad del camino. ¿Cómo vas con tus objetivos?";
  if (yearPct < 75) return "Más de la mitad del año. Hora de acelerar.";
  if (yearPct < 90) return "Recta final del año. Aprovecha bien el tiempo restante.";
  return "El año está por terminar. Cierra fuerte.";
}

export function TimeAwarenessWidget() {
  const now = new Date();

  // Year progress
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const endOfYear = new Date(now.getFullYear() + 1, 0, 1);
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000) + 1;
  const daysInYear = Math.floor((endOfYear.getTime() - startOfYear.getTime()) / 86400000);
  const yearPct = Math.round((dayOfYear / daysInYear) * 100);

  // Month progress
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthPct = Math.round((now.getDate() / daysInMonth) * 100);

  // Week progress (Mon=0, Sun=6)
  const dow = (now.getDay() + 6) % 7; // 0=Mon…6=Sun
  const weekPct = Math.round(((dow + 1) / 7) * 100);
  const weekNumber = Math.ceil(dayOfYear / 7);

  const monthNames = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const dayNames = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4 text-slate-400" />
        <h3 className="font-semibold text-slate-800 text-sm">Conciencia temporal</h3>
      </div>

      <div className="space-y-4">
        {/* Year */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs text-slate-600 font-medium">{now.getFullYear()}</span>
            <span className="text-xs text-slate-500">Día {dayOfYear} de {daysInYear} · <span className="font-semibold text-slate-700">{yearPct}%</span></span>
          </div>
          <ProgressBar pct={yearPct} color={yearPct > 75 ? "bg-orange-400" : yearPct > 50 ? "bg-amber-400" : "bg-[#1e3a5f]"} />
        </div>

        {/* Month */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs text-slate-600 font-medium">{monthNames[now.getMonth()]}</span>
            <span className="text-xs text-slate-500">Día {now.getDate()} de {daysInMonth} · <span className="font-semibold text-slate-700">{monthPct}%</span></span>
          </div>
          <ProgressBar pct={monthPct} color="bg-violet-400" />
        </div>

        {/* Week */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs text-slate-600 font-medium">{dayNames[dow]}, semana {weekNumber}</span>
            <span className="text-xs text-slate-500"><span className="font-semibold text-slate-700">{weekPct}%</span> de la semana</span>
          </div>
          <ProgressBar pct={weekPct} color="bg-emerald-400" />
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-400 italic">{motivationalMessage(yearPct)}</p>
    </div>
  );
}
