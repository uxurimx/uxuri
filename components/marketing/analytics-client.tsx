"use client";

import { useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Kpis {
  totalLeads: number;
  waConfirmed: number;
  converted: number;
  avgScore: number;
  sentLast30: number;
}
interface FunnelStep { status: string; count: number; }
interface NicheStat { niche: string; total: number; hot: number; avg_score: string; }
interface CityStat  { city: string; total: number; hot: number; }
interface DowPoint  { label: string; count: number; }
interface AbStat    { template: string; total: number; converted: number; rate: number; }
interface TimelineDay { day: string; sent: number; replies: number; }
interface CampaignRow {
  id: string; title: string; status: string;
  totalLeads: number; contacted: number; responded: number;
  interested: number; converted: number; startedAt: string | null;
}
interface WorkerRow { name: string; total: number; sent: number; replies: number; }

interface Props {
  kpis: Kpis;
  funnel: FunnelStep[];
  topNiches: NicheStat[];
  topCities: CityStat[];
  dowData: DowPoint[];
  abStats: AbStat[];
  timeline: TimelineDay[];
  campaigns: CampaignRow[];
  workers: WorkerRow[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const FUNNEL_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  nuevo:        { label: "Nuevo",        color: "bg-slate-400",   bg: "bg-slate-50"   },
  pendiente:    { label: "Pendiente",    color: "bg-cyan-400",    bg: "bg-cyan-50"    },
  contactado:   { label: "Contactado",   color: "bg-yellow-400",  bg: "bg-yellow-50"  },
  interesado:   { label: "Interesado",   color: "bg-green-500",   bg: "bg-green-50"   },
  no_responde:  { label: "No responde",  color: "bg-slate-400",   bg: "bg-slate-50"   },
  sin_whatsapp: { label: "Sin WhatsApp", color: "bg-orange-400",  bg: "bg-orange-50"  },
  cerrado:      { label: "Cerrado",      color: "bg-purple-500",  bg: "bg-purple-50"  },
  descartado:   { label: "Descartado",   color: "bg-red-400",     bg: "bg-red-50"     },
};

const STATUS_BADGE: Record<string, string> = {
  draft:     "bg-slate-100 text-slate-600",
  queued:    "bg-blue-100 text-blue-700",
  running:   "bg-green-100 text-green-700",
  completed: "bg-purple-100 text-purple-700",
  paused:    "bg-yellow-100 text-yellow-700",
  failed:    "bg-red-100 text-red-700",
};

function pct(n: number, total: number) {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function HBar({ value, max, color = "bg-[#1e3a5f]", className = "" }: {
  value: number; max: number; color?: string; className?: string;
}) {
  const w = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className={`h-2 rounded-full bg-slate-100 ${className}`}>
      <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${w}%` }} />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
      {children}
    </h2>
  );
}

// ── SVG Timeline Chart ────────────────────────────────────────────────────────

function TimelineChart({ data }: { data: TimelineDay[] }) {
  const W = 680; const H = 120; const PAD = { top: 8, right: 8, bottom: 24, left: 32 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const maxVal = Math.max(...data.map((d) => Math.max(d.sent, d.replies)), 1);
  const n = data.length;
  const step = innerW / (n - 1);

  const xOf = (i: number) => PAD.left + i * step;
  const yOf = (v: number) => PAD.top + innerH - (v / maxVal) * innerH;

  const polyline = (key: "sent" | "replies") =>
    data.map((d, i) => `${xOf(i)},${yOf(d[key])}`).join(" ");

  const area = (key: "sent" | "replies") => {
    const pts = data.map((d, i) => `${xOf(i)},${yOf(d[key])}`).join(" ");
    return `M${xOf(0)},${yOf(data[0][key])} L${pts} L${xOf(n - 1)},${PAD.top + innerH} L${xOf(0)},${PAD.top + innerH} Z`;
  };

  // X labels: show every 5 days
  const xLabels = data
    .map((d, i) => ({ i, label: i % 5 === 0 ? d.day.slice(5) : "" }))
    .filter((x) => x.label);

  // Y grid lines
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    y: PAD.top + innerH - f * innerH,
    v: Math.round(f * maxVal),
  }));

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 320 }}>
        {/* Grid */}
        {yTicks.map((t) => (
          <g key={t.y}>
            <line x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y}
              stroke="#f1f5f9" strokeWidth={1} />
            <text x={PAD.left - 4} y={t.y + 3.5} textAnchor="end"
              fontSize={8} fill="#94a3b8">{t.v}</text>
          </g>
        ))}

        {/* Areas */}
        <path d={area("sent")}    fill="#1e3a5f" fillOpacity={0.08} />
        <path d={area("replies")} fill="#22c55e" fillOpacity={0.10} />

        {/* Lines */}
        <polyline points={polyline("sent")}    fill="none" stroke="#1e3a5f" strokeWidth={1.5} />
        <polyline points={polyline("replies")} fill="none" stroke="#22c55e" strokeWidth={1.5} />

        {/* Dots on non-zero */}
        {data.map((d, i) => (
          <g key={i}>
            {d.sent > 0    && <circle cx={xOf(i)} cy={yOf(d.sent)}    r={2} fill="#1e3a5f" />}
            {d.replies > 0 && <circle cx={xOf(i)} cy={yOf(d.replies)} r={2} fill="#22c55e" />}
          </g>
        ))}

        {/* X labels */}
        {xLabels.map(({ i, label }) => (
          <text key={i} x={xOf(i)} y={H - 6} textAnchor="middle"
            fontSize={8} fill="#94a3b8">{label}</text>
        ))}
      </svg>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function AnalyticsClient({
  kpis, funnel, topNiches, topCities, dowData, abStats, timeline, campaigns, workers,
}: Props) {
  const [rightTab, setRightTab] = useState<"niches" | "cities">("niches");

  const convRate = pct(kpis.converted, kpis.totalLeads);
  const waRate   = pct(kpis.waConfirmed, kpis.totalLeads);

  const funnelMax = Math.max(...funnel.map((f) => f.count), 1);
  const dowMax    = Math.max(...dowData.map((d) => d.count), 1);
  const nicheMax  = Math.max(...topNiches.map((n) => n.total), 1);
  const cityMax   = Math.max(...topCities.map((c) => c.total), 1);
  const abMax     = Math.max(...abStats.map((a) => a.total), 1);

  return (
    <div className="space-y-6">

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: "Leads totales",    value: kpis.totalLeads.toLocaleString(), sub: "en base de datos",  color: "text-slate-800" },
          { label: "Enviados (30d)",   value: kpis.sentLast30.toLocaleString(), sub: "mensajes enviados", color: "text-blue-700" },
          { label: "Con WhatsApp",     value: `${waRate}%`,   sub: `${kpis.waConfirmed.toLocaleString()} confirmados`, color: "text-green-700" },
          { label: "Convertidos",      value: `${convRate}%`, sub: `${kpis.converted} leads → clientes`, color: "text-purple-700" },
          { label: "Score promedio",   value: kpis.avgScore > 0 ? kpis.avgScore.toFixed(1) : "—", sub: "de 10 puntos", color: "text-yellow-700" },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 font-medium mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Funnel + Día de semana ─────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-4">

        {/* Funnel */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <SectionTitle>Funnel de conversión</SectionTitle>
          <div className="space-y-2.5">
            {funnel.filter((f) => f.count > 0).sort((a, b) => b.count - a.count).map((f) => {
              const cfg = FUNNEL_CONFIG[f.status] ?? { label: f.status, color: "bg-slate-400", bg: "bg-slate-50" };
              return (
                <div key={f.status} className="flex items-center gap-3">
                  <span className={`text-xs font-medium w-24 shrink-0 px-2 py-0.5 rounded-full ${cfg.bg} text-slate-700`}>
                    {cfg.label}
                  </span>
                  <div className="flex-1">
                    <HBar value={f.count} max={funnelMax} color={cfg.color} />
                  </div>
                  <span className="text-xs text-slate-500 w-14 text-right shrink-0">
                    {f.count.toLocaleString()}
                    <span className="text-slate-300 ml-1">({pct(f.count, kpis.totalLeads)}%)</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Día de semana */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <SectionTitle>Mejores días para enviar</SectionTitle>
          {dowData.every((d) => d.count === 0) ? (
            <p className="text-sm text-slate-400 py-8 text-center">Sin datos de envíos aún</p>
          ) : (
            <div className="flex items-end gap-2 h-36 pt-2">
              {dowData.map((d) => {
                const h = dowMax > 0 ? Math.max(4, Math.round((d.count / dowMax) * 120)) : 4;
                const isTop = d.count === dowMax && d.count > 0;
                return (
                  <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs text-slate-500">{d.count > 0 ? d.count : ""}</span>
                    <div
                      className={`w-full rounded-t-md transition-all ${isTop ? "bg-[#1e3a5f]" : "bg-[#1e3a5f]/30"}`}
                      style={{ height: h }}
                    />
                    <span className={`text-xs font-medium ${isTop ? "text-[#1e3a5f]" : "text-slate-400"}`}>
                      {d.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {dowData.some((d) => d.count > 0) && (
            <p className="text-xs text-slate-400 mt-3">
              Mejor día: <span className="font-medium text-[#1e3a5f]">
                {dowData.find((d) => d.count === Math.max(...dowData.map((x) => x.count)))?.label}
              </span>
            </p>
          )}
        </div>
      </div>

      {/* ── Timeline 30 días ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Actividad últimos 30 días</SectionTitle>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-[#1e3a5f] rounded inline-block" /> Enviados
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-green-500 rounded inline-block" /> Respuestas
            </span>
          </div>
        </div>
        {timeline.every((d) => d.sent === 0 && d.replies === 0) ? (
          <p className="text-sm text-slate-400 py-8 text-center">Sin actividad en los últimos 30 días</p>
        ) : (
          <TimelineChart data={timeline} />
        )}
      </div>

      {/* ── Nichos / Ciudades + A/B ──────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-4">

        {/* Nichos / Ciudades con tab toggle */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <SectionTitle>Top {rightTab === "niches" ? "nichos" : "ciudades"}</SectionTitle>
            <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
              {(["niches", "cities"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setRightTab(t)}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                    rightTab === t ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {t === "niches" ? "Nichos" : "Ciudades"}
                </button>
              ))}
            </div>
          </div>
          {rightTab === "niches" ? (
            topNiches.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">Sin datos</p>
            ) : (
              <div className="space-y-2">
                {topNiches.map((n) => (
                  <div key={n.niche}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs text-slate-700 font-medium capitalize truncate max-w-[140px]">{n.niche}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-green-600 font-medium">
                          {pct(n.hot, n.total)}% hot
                        </span>
                        <span className="text-xs text-slate-400">{n.total.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex gap-0.5 h-1.5">
                      <div className="rounded-l-full bg-[#1e3a5f]/20"
                        style={{ width: `${pct(n.total - n.hot, nicheMax)}%` }} />
                      <div className="rounded-r-full bg-green-400"
                        style={{ width: `${pct(n.hot, nicheMax)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            topCities.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">Sin datos</p>
            ) : (
              <div className="space-y-2">
                {topCities.map((c) => (
                  <div key={c.city}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs text-slate-700 font-medium truncate max-w-[140px]">{c.city}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-green-600 font-medium">
                          {pct(c.hot, c.total)}% hot
                        </span>
                        <span className="text-xs text-slate-400">{c.total.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex gap-0.5 h-1.5">
                      <div className="rounded-l-full bg-[#1e3a5f]/20"
                        style={{ width: `${pct(c.total - c.hot, cityMax)}%` }} />
                      <div className="rounded-r-full bg-green-400"
                        style={{ width: `${pct(c.hot, cityMax)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
          <div className="flex items-center gap-3 mt-3 pt-2 border-t border-slate-100 text-xs text-slate-400">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[#1e3a5f]/20 inline-block"/>Total</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-green-400 inline-block"/>Hot (interesado+cerrado)</span>
          </div>
        </div>

        {/* A/B Testing */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <SectionTitle>A/B — Rendimiento por copy</SectionTitle>
          {abStats.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">
              Sin datos de templates aún.<br/>
              <span className="text-xs">Los leads necesitan el campo <code className="bg-slate-100 px-1 rounded">template_used</code>.</span>
            </p>
          ) : (
            <div className="space-y-3">
              {abStats.map((a) => (
                <div key={a.template}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-700 font-medium truncate max-w-[160px]" title={a.template}>
                      {a.template}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-bold ${a.rate >= 10 ? "text-green-600" : a.rate >= 5 ? "text-yellow-600" : "text-slate-400"}`}>
                        {a.rate}%
                      </span>
                      <span className="text-xs text-slate-400">{a.total}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full">
                    <div
                      className={`h-2 rounded-full transition-all ${a.rate >= 10 ? "bg-green-500" : a.rate >= 5 ? "bg-yellow-400" : "bg-slate-300"}`}
                      style={{ width: `${Math.max(2, pct(a.total, abMax))}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-slate-400">{a.converted} convertidos de {a.total}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Campañas recientes ─────────────────────────────────────────────── */}
      {campaigns.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-100">
            <SectionTitle>Campañas — embudo de conversión</SectionTitle>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100">
                  <th className="text-left px-5 py-2.5 font-medium">Campaña</th>
                  <th className="text-center px-3 py-2.5 font-medium">Estado</th>
                  <th className="text-right px-3 py-2.5 font-medium">Leads</th>
                  <th className="text-right px-3 py-2.5 font-medium">Contactados</th>
                  <th className="text-right px-3 py-2.5 font-medium">Respondieron</th>
                  <th className="text-right px-3 py-2.5 font-medium">Interesados</th>
                  <th className="text-right px-5 py-2.5 font-medium">Convertidos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {campaigns.map((c) => {
                  const base = c.contacted || c.totalLeads || 1;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-800 text-sm truncate max-w-[180px]">{c.title}</p>
                        {c.startedAt && (
                          <p className="text-xs text-slate-400">
                            {new Date(c.startedAt).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[c.status] ?? "bg-slate-100 text-slate-600"}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right text-slate-700 font-medium">{c.totalLeads}</td>
                      <td className="px-3 py-3 text-right">
                        <span className="text-slate-700">{c.contacted}</span>
                        <span className="text-slate-300 text-xs ml-1">({pct(c.contacted, c.totalLeads || 1)}%)</span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="text-slate-700">{c.responded}</span>
                        <span className="text-slate-300 text-xs ml-1">({pct(c.responded, base)}%)</span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="text-green-600 font-medium">{c.interested}</span>
                        <span className="text-slate-300 text-xs ml-1">({pct(c.interested, base)}%)</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-purple-600 font-bold">{c.converted}</span>
                        <span className="text-slate-300 text-xs ml-1">({pct(c.converted, base)}%)</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Workers ───────────────────────────────────────────────────────── */}
      {workers.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <SectionTitle>Performance por trabajador</SectionTitle>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {workers.map((w) => {
              const replyRate = pct(w.replies, w.sent);
              return (
                <div key={w.name} className="border border-slate-100 rounded-lg p-3">
                  <p className="font-semibold text-slate-800 text-sm truncate">{w.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{w.total} interacciones</p>
                  <div className="mt-2 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Enviados</span>
                      <span className="font-medium text-slate-700">{w.sent}</span>
                    </div>
                    <HBar value={w.sent} max={workers[0].sent || 1} />
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Tasa respuesta</span>
                      <span className={`font-medium ${replyRate >= 10 ? "text-green-600" : replyRate >= 5 ? "text-yellow-600" : "text-slate-400"}`}>
                        {replyRate}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
