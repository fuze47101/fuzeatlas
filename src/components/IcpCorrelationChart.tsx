"use client";

/**
 * <IcpCorrelationChart /> — MB-1 ICP × AB scatter.
 *
 * Pure SVG, no chart library. Mirrors the WashProtectionChart
 * pattern from the sustainability page. X-axis: FUZE residual on
 * fabric (mg/kg, the ICP measurement). Y-axis: AB percent reduction
 * (0-100). Best-fit regression line overlaid. Hover any dot for
 * fabric / factory / tier / date.
 *
 * Brand-voice note: the X-axis is "FUZE residual" — NEVER "silver"
 * or "Ag" in customer-facing copy. The underlying DB column is
 * `agValue` because lab reports use Ag, but the UI label is locked.
 */

import { useMemo, useState } from "react";

interface Point {
  testRunId: string;
  fabricId: string | null;
  fuzeNumber: number | null;
  factoryName: string | null;
  brandName: string | null;
  tier: string | null;
  testDate: string | null;
  icpValue: number;
  abPercentReduction: number;
  testMethod: string | null;
}

interface Regression {
  slope: number;
  intercept: number;
  r2: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface Props {
  points: Point[];
  regression: Regression | null;
  /** Show brand column in tooltip — only useful in admin scope. */
  showBrand?: boolean;
  className?: string;
}

const TIER_COLOR: Record<string, string> = {
  F1: "#10b981", // emerald
  F2: "#0ea5e9", // sky
  F3: "#f59e0b", // amber
  F4: "#a78bfa", // violet
};
const DEFAULT_COLOR = "#64748b";

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function IcpCorrelationChart({
  points,
  regression,
  showBrand,
  className = "",
}: Props) {
  const [hover, setHover] = useState<Point | null>(null);

  // Chart geometry.
  const W = 800;
  const H = 460;
  const PAD_L = 70;
  const PAD_R = 28;
  const PAD_T = 24;
  const PAD_B = 56;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const { xMin, xMax, yMax } = useMemo(() => {
    if (points.length === 0) {
      return { xMin: 0, xMax: 1, yMax: 100 };
    }
    const xs = points.map((p) => p.icpValue);
    const ys = points.map((p) => p.abPercentReduction);
    const xMinRaw = Math.min(...xs);
    const xMaxRaw = Math.max(...xs);
    const yMaxRaw = Math.max(...ys);
    const xMin = Math.max(0, xMinRaw - (xMaxRaw - xMinRaw) * 0.05);
    const xMax = xMaxRaw + Math.max(0.1, (xMaxRaw - xMinRaw) * 0.05);
    const yMax = Math.max(100, yMaxRaw * 1.05);
    return { xMin, xMax, yMax };
  }, [points]);

  const x = (v: number) => PAD_L + ((v - xMin) / (xMax - xMin || 1)) * innerW;
  const y = (v: number) => PAD_T + innerH - (v / (yMax || 1)) * innerH;

  // Y-axis ticks: 0, 25, 50, 75, 100 (+ above if data goes there).
  const yTicks: number[] = [];
  for (let v = 0; v <= yMax; v += 25) yTicks.push(v);

  // X-axis ticks — 6 evenly spaced.
  const xTicks: number[] = [];
  for (let i = 0; i <= 6; i++) {
    xTicks.push(xMin + ((xMax - xMin) * i) / 6);
  }

  return (
    <div
      className={`relative bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`}
    >
      <div className="px-6 pt-5 pb-2">
        <h3 className="text-base font-bold text-slate-900">
          FUZE residual on fabric vs. antibacterial kill rate
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Every brand-visible TestRun in the dataset with both an ICP residual measurement
          and an AB percent-reduction result. {points.length} point
          {points.length === 1 ? "" : "s"}.
          {regression && (
            <>
              {" "}
              Best-fit slope:{" "}
              <strong className="text-slate-700">
                {regression.slope.toFixed(2)}
              </strong>{" "}
              · R²:{" "}
              <strong className="text-slate-700">{regression.r2.toFixed(3)}</strong>
            </>
          )}
        </p>
      </div>

      {points.length === 0 ? (
        <div className="px-6 py-16 text-center text-sm text-slate-400">
          No brand-visible test runs with both ICP + AB data yet. As tests are
          stamped brand-visible the chart fills in.
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          role="img"
          aria-label="ICP × AB correlation scatter chart"
        >
          {/* Y-axis grid */}
          {yTicks.map((v) => (
            <g key={`y-${v}`}>
              <line
                x1={PAD_L}
                x2={W - PAD_R}
                y1={y(v)}
                y2={y(v)}
                stroke="#cbd5e1"
                strokeWidth={v === 0 ? 1 : 0.5}
                strokeDasharray={v === 0 ? undefined : "2 4"}
              />
              <text
                x={PAD_L - 10}
                y={y(v) + 4}
                textAnchor="end"
                fontSize={11}
                fill="#475569"
              >
                {v}%
              </text>
            </g>
          ))}

          {/* X-axis ticks */}
          {xTicks.map((v, i) => (
            <g key={`x-${i}`}>
              <line
                x1={x(v)}
                x2={x(v)}
                y1={H - PAD_B}
                y2={H - PAD_B + 4}
                stroke="#cbd5e1"
              />
              <text
                x={x(v)}
                y={H - PAD_B + 18}
                textAnchor="middle"
                fontSize={11}
                fill="#475569"
              >
                {v.toFixed(2)}
              </text>
            </g>
          ))}

          {/* Axis labels */}
          <text
            x={PAD_L + innerW / 2}
            y={H - 10}
            textAnchor="middle"
            fontSize={12}
            fontWeight={700}
            fill="#0f172a"
          >
            FUZE residual (mg/kg fabric)
          </text>
          <text
            x={16}
            y={PAD_T + innerH / 2}
            textAnchor="middle"
            fontSize={12}
            fontWeight={700}
            fill="#0f172a"
            transform={`rotate(-90 16 ${PAD_T + innerH / 2})`}
          >
            AB kill rate (% reduction)
          </text>

          {/* Regression line */}
          {regression && (
            <line
              x1={x(regression.x1)}
              y1={y(Math.max(0, Math.min(yMax, regression.y1)))}
              x2={x(regression.x2)}
              y2={y(Math.max(0, Math.min(yMax, regression.y2)))}
              stroke="#00b4c3"
              strokeWidth={2}
              strokeDasharray="6 4"
              opacity={0.8}
            />
          )}

          {/* Data points */}
          {points.map((p) => {
            const color = (p.tier && TIER_COLOR[p.tier]) || DEFAULT_COLOR;
            const cx = x(p.icpValue);
            const cy = y(p.abPercentReduction);
            const isHover = hover?.testRunId === p.testRunId;
            return (
              <circle
                key={p.testRunId}
                cx={cx}
                cy={cy}
                r={isHover ? 7 : 4.5}
                fill={color}
                stroke="white"
                strokeWidth={1.5}
                opacity={hover && !isHover ? 0.35 : 0.85}
                style={{ cursor: "pointer", transition: "r 0.12s, opacity 0.12s" }}
                onMouseEnter={() => setHover(p)}
                onMouseLeave={() => setHover((h) => (h?.testRunId === p.testRunId ? null : h))}
              />
            );
          })}
        </svg>
      )}

      {/* Tier legend */}
      {points.length > 0 && (
        <div className="px-6 pb-4 flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <span className="font-bold uppercase tracking-wider text-slate-500">Tier</span>
          {Object.entries(TIER_COLOR).map(([tier, color]) => (
            <span key={tier} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              {tier}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ backgroundColor: DEFAULT_COLOR }}
            />
            Unspecified
          </span>
        </div>
      )}

      {/* Hover tooltip — absolutely positioned below the chart so it
          never overflows the SVG bounds. */}
      {hover && (
        <div className="px-6 pb-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
            <div className="flex items-center justify-between mb-1.5 gap-3">
              <div className="font-bold text-slate-900">
                {hover.fuzeNumber != null ? `FUZE-${hover.fuzeNumber}` : hover.testRunId.slice(0, 10)}
                {hover.tier && (
                  <span
                    className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold text-white"
                    style={{ backgroundColor: (hover.tier && TIER_COLOR[hover.tier]) || DEFAULT_COLOR }}
                  >
                    {hover.tier}
                  </span>
                )}
              </div>
              <span className="text-slate-500">{fmtDate(hover.testDate)}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-slate-700">
              {showBrand && hover.brandName && (
                <div>
                  <span className="text-slate-400">Brand:</span>{" "}
                  <span className="font-semibold">{hover.brandName}</span>
                </div>
              )}
              {hover.factoryName && (
                <div>
                  <span className="text-slate-400">Factory:</span>{" "}
                  <span className="font-semibold">{hover.factoryName}</span>
                </div>
              )}
              <div>
                <span className="text-slate-400">FUZE residual:</span>{" "}
                <span className="font-semibold">{hover.icpValue.toFixed(3)} mg/kg</span>
              </div>
              <div>
                <span className="text-slate-400">AB reduction:</span>{" "}
                <span className="font-semibold">{hover.abPercentReduction.toFixed(2)}%</span>
              </div>
              {hover.testMethod && (
                <div className="col-span-2">
                  <span className="text-slate-400">Method:</span>{" "}
                  <span className="font-mono">{hover.testMethod}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
