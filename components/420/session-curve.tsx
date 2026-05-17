"use client";

export interface CurveCheckin {
  minutesMark: number;
  intensity: number;
}

interface Props {
  checkins: CurveCheckin[];
  color?: string;
  height?: number;
  mini?: boolean;
}

function catmullRom(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

export function SessionCurve({ checkins, color = "#00c896", height = 140, mini = false }: Props) {
  const W = 300;
  const padX = mini ? 8 : 32;
  const padT = mini ? 6 : 20;
  const padB = mini ? 6 : 20;
  const innerW = W - padX * 2;
  const innerH = height - padT - padB;

  if (checkins.length === 0) {
    return (
      <div
        style={{ height, color: "rgba(255,255,255,0.2)" }}
        className="flex items-center justify-center text-xs"
      >
        Sin check-ins aún
      </div>
    );
  }

  const maxMin = Math.max(...checkins.map((c) => c.minutesMark), 15);

  const pts = checkins.map((c) => ({
    x: padX + (c.minutesMark / maxMin) * innerW,
    y: padT + ((10 - c.intensity) / 9) * innerH,
    ...c,
  }));

  const linePath = catmullRom(pts);
  const areaPath =
    linePath +
    ` L ${pts[pts.length - 1].x.toFixed(2)} ${(height - padB).toFixed(2)}` +
    ` L ${padX} ${(height - padB).toFixed(2)} Z`;

  const gId = `g${Math.random().toString(36).slice(2, 7)}`;

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id={gId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
        <filter id={`glow-${gId}`}>
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Grid lines */}
      {!mini &&
        [2, 4, 6, 8, 10].map((v) => {
          const y = padT + ((10 - v) / 9) * innerH;
          return (
            <g key={v}>
              <line
                x1={padX}
                y1={y}
                x2={W - padX}
                y2={y}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="1"
                strokeDasharray="3 4"
              />
              <text
                x={padX - 5}
                y={y + 3.5}
                textAnchor="end"
                fill="rgba(255,255,255,0.2)"
                fontSize="9"
              >
                {v}
              </text>
            </g>
          );
        })}

      {/* Area fill */}
      <path d={areaPath} fill={`url(#${gId})`} />

      {/* Curve line */}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={mini ? 1.5 : 2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={mini ? undefined : `url(#glow-${gId})`}
      />

      {/* Dots & labels */}
      {pts.map((pt, i) => (
        <g key={i}>
          {!mini && (
            <>
              <circle cx={pt.x} cy={pt.y} r={10} fill={color} opacity={0.08} />
              <circle cx={pt.x} cy={pt.y} r={4} fill={color} />
              <text
                x={pt.x}
                y={pt.y - 11}
                textAnchor="middle"
                fill={color}
                fontSize="10"
                fontWeight="700"
              >
                {pt.intensity}
              </text>
              <text
                x={pt.x}
                y={height - 4}
                textAnchor="middle"
                fill="rgba(255,255,255,0.25)"
                fontSize="8"
              >
                {pt.minutesMark}m
              </text>
            </>
          )}
          {mini && <circle cx={pt.x} cy={pt.y} r={2.5} fill={color} />}
        </g>
      ))}
    </svg>
  );
}
