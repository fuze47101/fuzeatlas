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

/** Staleness label + tailwind class from a days-since-activity value. */
export function staleness(daysSinceActivity: number | null): { text: string; cls: string } {
  if (daysSinceActivity == null) return { text: "No activity", cls: "text-rose-600 font-semibold" };
  const d = daysSinceActivity;
  const text = d === 0 ? "Today" : d === 1 ? "1 day ago" : `${d} days ago`;
  if (d > 14) return { text, cls: "text-rose-600 font-semibold" };
  if (d > 7) return { text, cls: "text-amber-600 font-medium" };
  return { text, cls: "text-slate-600" };
}
