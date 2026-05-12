"use client";

/**
 * Wash Protection Chart — the sales weapon Andrew sharpened 2026-05-04.
 *
 * Honest framing:
 *   • FUZE and competitors are BOTH applied at the mill. Neither can be
 *     reapplied to a garment that has shipped to a customer.
 *   • FUZE flat per-meter cost across the tier's full wash life (e.g. F4
 *     = $0.07/m, validated by AATCC 100 third-party data through 25 washes).
 *   • Competitor per-meter cost is the same shape — flat. The brand pays
 *     once. What ends at the competitor's wash claim is not "cost" but
 *     "validated coverage" — and that wash number is self-published
 *     marketing, not EPA-certified or third-party validated.
 *   • The chart shows BOTH lines flat across the entire wash range, with
 *     a labelled "MARKETING CLAIM ENDS HERE — no third-party validation"
 *     annotation at the competitor's wash limit.
 *
 * EPA does NOT validate or certify wash counts. EPA registers the active
 * ingredient as a pesticide. That is the point we want every viewer of
 * this chart to walk away with.
 */

import type { Competitor, CostComparison } from "@/lib/competitors";

interface Props {
  /** Output of calcCostComparison(). */
  comparison: CostComparison;
  /** The competitor itself, for the labels + marketing-vs-EPA note. */
  competitor: Competitor;
  /** Optional: brand-side label (default "FUZE F4"). Override to e.g. "FUZE F1". */
  fuzeLabel?: string;
  /** SVG width — defaults responsive. */
  className?: string;
}

const COLORS = {
  fuze: "#10b981",       // emerald-500
  fuzeArea: "rgba(16, 185, 129, 0.15)",
  comp: "#dc2626",       // red-600
  compMarketing: "rgba(220, 38, 38, 0.4)",
  unprotected: "rgba(220, 38, 38, 0.10)",
  axis: "#cbd5e1",       // slate-300
  text: "#475569",       // slate-600
  textBold: "#0f172a",   // slate-900
};

export default function WashProtectionChart({ comparison, competitor, fuzeLabel = "FUZE", className = "" }: Props) {
  const {
    curve,
    fuzeCostPerMeter,
    competitorCostPerApplication,
    competitorMaxProtectedWashes,
    competitorMarketingWashClaim,
    competitorUnprotectedWashes,
    targetWashes,
    fuzeTierLabel,
  } = comparison;

  // Chart geometry
  const W = 760;
  const H = 360;
  const PAD_L = 60;
  const PAD_R = 24;
  const PAD_T = 30;
  const PAD_B = 60;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  // Y range — $0 → $0.10 covers the realistic span; clamp to data max + 30% headroom.
  const allCosts = curve.flatMap((p) => [p.fuzeCostPerMeter, p.competitorCostPerMeter ?? 0]);
  const yMaxRaw = Math.max(0.10, ...allCosts);
  const yMax = yMaxRaw * 1.3;
  const xMax = targetWashes;

  const x = (wash: number) => PAD_L + (wash / xMax) * innerW;
  const y = (cost: number) => PAD_T + innerH - (cost / yMax) * innerH;

  // FUZE line (always full-width, flat).
  const fuzeY = y(fuzeCostPerMeter);
  const fuzePath = `M ${x(0)} ${fuzeY} L ${x(xMax)} ${fuzeY}`;

  // Competitor line — flat at firstAppCost up to EPA cliff, then nothing.
  const compY = y(competitorCostPerApplication);
  const compEnd = Math.min(competitorMaxProtectedWashes, xMax);
  const compPath = `M ${x(0)} ${compY} L ${x(compEnd)} ${compY}`;

  // Marketing-claim ghost line (dotted) if their marketing number differs and
  // the chart range is wide enough to show it.
  const showMarketing =
    competitorMarketingWashClaim &&
    competitorMarketingWashClaim > competitorMaxProtectedWashes &&
    competitorMarketingWashClaim <= xMax;
  const marketingEnd = competitorMarketingWashClaim
    ? Math.min(competitorMarketingWashClaim, xMax)
    : 0;

  // Y-axis ticks
  const yTicks: number[] = [];
  const tickStep = yMax > 0.10 ? 0.05 : 0.02;
  for (let v = 0; v <= yMax; v += tickStep) yTicks.push(Number(v.toFixed(2)));
  // X-axis ticks every 25 washes
  const xTicks: number[] = [];
  for (let w = 0; w <= xMax; w += 25) xTicks.push(w);
  if (xTicks[xTicks.length - 1] !== xMax) xTicks.push(xMax);

  return (
    <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`}>
      <div className="px-6 pt-5 pb-2">
        <h3 className="text-base font-bold text-slate-900">
          Wash claim — what each side can actually defend
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Both products are mill-applied; brand pays once. The difference isn&apos;t cost — it&apos;s whether the wash claim is third-party validated.
          FUZE has documented AATCC 100 reports across all four tiers. {competitor.product}&apos;s {competitorMaxProtectedWashes}-wash number is self-published.
          EPA does NOT validate any wash count.
        </p>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Wash protection cost chart">
        {/* Y-axis grid + labels */}
        {yTicks.map((v) => (
          <g key={`y-${v}`}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={y(v)}
              y2={y(v)}
              stroke={COLORS.axis}
              strokeDasharray={v === 0 ? undefined : "2 4"}
              strokeWidth={v === 0 ? 1 : 0.5}
            />
            <text x={PAD_L - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill={COLORS.text}>
              ${v.toFixed(2)}
            </text>
          </g>
        ))}

        {/* X-axis ticks */}
        {xTicks.map((w) => (
          <g key={`x-${w}`}>
            <line x1={x(w)} x2={x(w)} y1={H - PAD_B} y2={H - PAD_B + 4} stroke={COLORS.axis} />
            <text x={x(w)} y={H - PAD_B + 18} textAnchor="middle" fontSize={11} fill={COLORS.text}>
              {w}
            </text>
          </g>
        ))}
        <text x={PAD_L + innerW / 2} y={H - 8} textAnchor="middle" fontSize={12} fontWeight={600} fill={COLORS.textBold}>
          Wash cycles
        </text>
        <text
          x={16}
          y={PAD_T + innerH / 2}
          textAnchor="middle"
          fontSize={12}
          fontWeight={600}
          fill={COLORS.textBold}
          transform={`rotate(-90 16 ${PAD_T + innerH / 2})`}
        >
          $/meter (per garment)
        </text>

        {/* Unprotected zone — red wash beyond EPA cliff */}
        {competitorUnprotectedWashes > 0 && (
          <rect
            x={x(competitorMaxProtectedWashes)}
            y={PAD_T}
            width={x(xMax) - x(competitorMaxProtectedWashes)}
            height={innerH}
            fill={COLORS.unprotected}
          />
        )}

        {/* FUZE flat line + label dot at end */}
        <path d={fuzePath} stroke={COLORS.fuze} strokeWidth={3} fill="none" strokeLinecap="round" />
        <circle cx={x(xMax)} cy={fuzeY} r={5} fill={COLORS.fuze} stroke="#fff" strokeWidth={2} />
        <text
          x={x(xMax) - 6}
          y={fuzeY - 12}
          textAnchor="end"
          fontSize={12}
          fontWeight={700}
          fill={COLORS.fuze}
        >
          {fuzeLabel} {fuzeTierLabel} • ${fuzeCostPerMeter.toFixed(2)}/m through wash {xMax}
        </text>

        {/* Marketing-claim ghost line — only shown if it materially differs */}
        {showMarketing && (
          <>
            <line
              x1={x(competitorMaxProtectedWashes)}
              x2={x(marketingEnd)}
              y1={compY}
              y2={compY}
              stroke={COLORS.compMarketing}
              strokeWidth={2}
              strokeDasharray="5 5"
            />
            <text
              x={x((competitorMaxProtectedWashes + marketingEnd) / 2)}
              y={compY - 8}
              textAnchor="middle"
              fontSize={10}
              fill={COLORS.compMarketing}
            >
              marketing claim, not on EPA label
            </text>
          </>
        )}

        {/* Competitor flat line up to where their marketing claim ends */}
        <path d={compPath} stroke={COLORS.comp} strokeWidth={3} fill="none" strokeLinecap="round" />
        <circle cx={x(0)} cy={compY} r={5} fill={COLORS.comp} stroke="#fff" strokeWidth={2} />
        <text x={x(0) + 8} y={compY - 10} fontSize={11} fontWeight={700} fill={COLORS.comp}>
          {competitor.product} • ${competitorCostPerApplication.toFixed(2)}/m (one mill application)
        </text>

        {/* Marketing-claim cliff marker — annotation drops BELOW the line so
            it stops colliding with the competitor product label above. The
            short dotted tick down to the unprotected-zone band is now ~32px
            tall instead of running all the way to the X-axis. */}
        <circle cx={x(compEnd)} cy={compY} r={6} fill={COLORS.comp} stroke="#fff" strokeWidth={2} />
        <line
          x1={x(compEnd)}
          x2={x(compEnd)}
          y1={compY + 6}
          y2={compY + 28}
          stroke={COLORS.comp}
          strokeDasharray="3 3"
          strokeWidth={1.5}
        />
        <text
          x={x(compEnd)}
          y={compY + 44}
          textAnchor={compEnd > xMax * 0.6 ? "end" : "start"}
          fontSize={11}
          fontWeight={700}
          fill={COLORS.comp}
        >
          Marketing claim ends: {competitorMaxProtectedWashes} washes (self-published)
        </text>

        {/* Unvalidated zone annotation — past the competitor's marketing number */}
        {competitorUnprotectedWashes > 0 && (
          <g>
            <text
              x={x((competitorMaxProtectedWashes + xMax) / 2)}
              y={PAD_T + innerH / 2 - 8}
              textAnchor="middle"
              fontSize={13}
              fontWeight={700}
              fill={COLORS.comp}
            >
              NO VALIDATED WASH DATA HERE
            </text>
            <text
              x={x((competitorMaxProtectedWashes + xMax) / 2)}
              y={PAD_T + innerH / 2 + 10}
              textAnchor="middle"
              fontSize={11}
              fill={COLORS.comp}
            >
              {competitor.company.split(" ")[0]} doesn&apos;t publish third-party AATCC 100 data
            </text>
            <text
              x={x((competitorMaxProtectedWashes + xMax) / 2)}
              y={PAD_T + innerH / 2 + 28}
              textAnchor="middle"
              fontSize={11}
              fontWeight={600}
              fill={COLORS.comp}
            >
              and no reapplication is possible — the garment has shipped
            </text>
          </g>
        )}
      </svg>

      {/* Footer takeaway — three honest cards */}
      <div className="px-6 pb-5 pt-2 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <div className="font-bold text-emerald-700">{fuzeLabel} {fuzeTierLabel}</div>
          <div className="text-emerald-600 mt-1">
            ${fuzeCostPerMeter.toFixed(2)}/m. {xMax}-wash claim backed by AATCC 100 reports we share with brands on request.
          </div>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <div className="font-bold text-red-700">{competitor.product}</div>
          <div className="text-red-600 mt-1">
            ${competitorCostPerApplication.toFixed(2)}/m. {competitorMaxProtectedWashes}-wash claim is {competitor.company.split(" ")[0]} marketing — no public third-party validation.
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="font-bold text-slate-700">EPA reality check</div>
          <div className="text-slate-600 mt-1">
            EPA registers active ingredients as pesticides. EPA does NOT validate or certify any wash count. Every wash number on a competitor data sheet comes from their own internal testing.
          </div>
        </div>
      </div>
    </div>
  );
}
