// Shared Red Rover UI constants + helpers (no JSX — safe to import anywhere).

export const STAGE_ORDER = [
  "IDENTIFIED",
  "CONTACTED",
  "PRESENTATION",
  "TESTING",
  "AGREEMENT",
  "ACTIVE",
  "STALLED",
  "PARKED",
] as const;

export const STAGE_COLORS: Record<string, string> = {
  IDENTIFIED: "bg-slate-100 text-slate-700",
  CONTACTED: "bg-sky-100 text-sky-800",
  PRESENTATION: "bg-indigo-100 text-indigo-800",
  TESTING: "bg-violet-100 text-violet-800",
  AGREEMENT: "bg-amber-100 text-amber-900",
  ACTIVE: "bg-emerald-100 text-emerald-800",
  STALLED: "bg-rose-100 text-rose-800",
  PARKED: "bg-gray-200 text-gray-600",
};

export const STAGE_COLUMN_ACCENT: Record<string, string> = {
  IDENTIFIED: "border-slate-300",
  CONTACTED: "border-sky-300",
  PRESENTATION: "border-indigo-300",
  TESTING: "border-violet-300",
  AGREEMENT: "border-amber-300",
  ACTIVE: "border-emerald-300",
  STALLED: "border-rose-300",
  PARKED: "border-gray-300",
};

export const TIER_COLORS: Record<string, string> = {
  TIER1: "bg-rose-600 text-white",
  TIER2: "bg-amber-500 text-white",
  PARKED: "bg-slate-400 text-white",
};

export const ACTIVITY_ICON: Record<string, string> = {
  NOTE: "📝",
  MEETING: "🤝",
  EMAIL: "✉️",
  STATUS_CHANGE: "🔀",
  MILESTONE: "🏁",
};

export const ACTIVITY_TYPES = ["NOTE", "MEETING", "EMAIL", "STATUS_CHANGE", "MILESTONE"];

/** Stage → default win probability (%). Used when a target has no manual
 * winProbabilityPct override. Server- and client-safe. */
export const STAGE_WIN_PROB: Record<string, number> = {
  IDENTIFIED: 5,
  CONTACTED: 15,
  PRESENTATION: 25,
  TESTING: 40,
  AGREEMENT: 65,
  ACTIVE: 90,
  STALLED: 10,
  PARKED: 0,
};

export function stageDefaultProb(stage: string): number {
  return STAGE_WIN_PROB[stage] ?? 0;
}

/** Effective probability = manual override if set, else the stage default. */
export function effectiveProb(stage: string, winProbabilityPct: number | null | undefined): number {
  return winProbabilityPct == null ? stageDefaultProb(stage) : winProbabilityPct;
}

/** weightedValue = projectedValueUsd × effectiveProb / 100. */
export function weightedValue(
  projectedValueUsd: number | null | undefined,
  winProbabilityPct: number | null | undefined,
  stage: string,
): number {
  const v = projectedValueUsd ?? 0;
  return v * (effectiveProb(stage, winProbabilityPct) / 100);
}

/** Compact USD formatter for the forecast strip ($1.2M, $850K, $0). */
export function fmtUsd(n: number): string {
  if (!n) return "$0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

/** Staleness label + tailwind class from a days-since-activity value. */
export function staleness(daysSinceActivity: number | null): { text: string; cls: string } {
  if (daysSinceActivity == null) return { text: "No activity", cls: "text-rose-600 font-semibold" };
  const d = daysSinceActivity;
  const text = d === 0 ? "Today" : d === 1 ? "1 day ago" : `${d} days ago`;
  if (d > 14) return { text, cls: "text-rose-600 font-semibold" };
  if (d > 7) return { text, cls: "text-amber-600 font-medium" };
  return { text, cls: "text-slate-600" };
}
