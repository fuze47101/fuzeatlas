/**
 * Test result scoring + brand-safe presentation (ticket #34).
 *
 * Two jobs:
 *   1. Compute a 0–100 "fantasticScore" so the searchable test-results
 *      library can sort strongest-PASS-margin first ("fantastic first" per
 *      Andrew's brief).
 *   2. Convert raw PASS/FAIL into a brand-safe label. Brand users never see
 *      the word FAIL — those rows render as "Development & Application
 *      Validation Result" so reps don't have to defensively hide R&D
 *      iteration data. Admins still see PASS/FAIL.
 *
 * The score is a heuristic, not a regulatory signal. It exists to surface
 * the most demo-worthy tests to brand stakeholders. Tweaks land here so the
 * UI doesn't have to know about result shape.
 */
// Locally-defined shapes so this lib is callable from anywhere without
// pulling in the Prisma client types (some callers run before Prisma
// generate, e.g. tests / scripts).
export type ResultStatus = "PASS" | "FAIL" | "MEASUREMENT" | "UNKNOWN";

export interface ScoredTestRun {
  /** 0–100, higher = more "fantastic". Null when no result is attached. */
  fantasticScore: number | null;
  /** Raw status — reveal only to admins. */
  rawStatus: ResultStatus;
  /** Short numeric blurb for the row, e.g. "99.99%" or "Ag 1.42 ppm". */
  resultLabel: string | null;
}

interface IcpResultLike {
  agValue?: number | null;
  auValue?: number | null;
  unit?: string | null;
}
interface AbResultLike {
  percentReduction?: number | null;
  activityValue?: number | null;
  growthValue?: number | null;
  methodPass?: boolean | null;
  pass?: boolean | null;
}
interface BinaryResultLike {
  pass?: boolean | null;
}
interface RunForScoring {
  testType: string | null;
  icpResult?: IcpResultLike | null;
  abResult?: AbResultLike | null;
  fungalResult?: BinaryResultLike | null;
  odorResult?: BinaryResultLike | null;
}

/**
 * Map a raw result to (score, status, label). Designed to degrade
 * gracefully — missing fields just lower the confidence of the score
 * rather than throwing.
 */
export function scoreTestRun(run: RunForScoring): ScoredTestRun {
  const t = (run.testType || "").toUpperCase();

  // ── ICP: pure measurement, never PASS/FAIL ──────────────────────
  if (t === "ICP" && run.icpResult) {
    const ag = run.icpResult.agValue ?? null;
    // Most "great" FUZE F1 ICP values land 0.8–2.0 ppm. Map 0→0, 2→100.
    const score = ag != null ? Math.min(100, Math.round((ag / 2.0) * 100)) : null;
    return {
      fantasticScore: score,
      rawStatus: "MEASUREMENT",
      resultLabel: ag != null ? `Ag ${ag.toFixed(2)} ${run.icpResult.unit || "ppm"}` : null,
    };
  }

  // ── Antibacterial: AATCC %reduction OR JIS A-value OR growth F ──
  if (t === "ANTIBACTERIAL" && run.abResult) {
    const r = run.abResult;
    const explicitPass = r.methodPass ?? r.pass ?? null;
    if (r.percentReduction != null) {
      const pct = r.percentReduction;
      // 99.99% (4-log) is the gold standard → 100. Linear up to that.
      const score = Math.max(0, Math.min(100, Math.round((pct / 99.99) * 100)));
      return {
        fantasticScore: explicitPass === false ? 0 : score,
        rawStatus: explicitPass === false ? "FAIL" : "PASS",
        resultLabel: `${pct.toFixed(2)}% reduction`,
      };
    }
    if (r.activityValue != null) {
      // JIS: A>=2.0 = Effect, A>=3.0 = Strong Effect. Map 4.0→100.
      const a = r.activityValue;
      const score = Math.max(0, Math.min(100, Math.round((a / 4.0) * 100)));
      return {
        fantasticScore: explicitPass === false ? 0 : score,
        rawStatus: a >= 2 ? "PASS" : "FAIL",
        resultLabel: `A=${a.toFixed(2)}`,
      };
    }
    if (r.growthValue != null) {
      // Lower growth F = better. F=0 → 100, F=5 → 0.
      const f = r.growthValue;
      const score = Math.max(0, Math.min(100, Math.round(100 - f * 20)));
      return {
        fantasticScore: explicitPass === false ? 0 : score,
        rawStatus: explicitPass === false ? "FAIL" : "PASS",
        resultLabel: `F=${f.toFixed(2)}`,
      };
    }
    // No numeric — fall back to pass flag.
    return {
      fantasticScore: explicitPass === true ? 60 : explicitPass === false ? 0 : null,
      rawStatus: explicitPass === true ? "PASS" : explicitPass === false ? "FAIL" : "UNKNOWN",
      resultLabel: null,
    };
  }

  // ── Fungal / Odor: binary pass ──────────────────────────────────
  if (t === "FUNGAL" && run.fungalResult) {
    const p = run.fungalResult.pass;
    return {
      fantasticScore: p === true ? 80 : p === false ? 0 : null,
      rawStatus: p === true ? "PASS" : p === false ? "FAIL" : "UNKNOWN",
      resultLabel: null,
    };
  }
  if (t === "ODOR" && run.odorResult) {
    const p = run.odorResult.pass;
    return {
      fantasticScore: p === true ? 80 : p === false ? 0 : null,
      rawStatus: p === true ? "PASS" : p === false ? "FAIL" : "UNKNOWN",
      resultLabel: null,
    };
  }

  return { fantasticScore: null, rawStatus: "UNKNOWN", resultLabel: null };
}

/**
 * Brand-safe view of a scored test run. When `protectFails` is on (default
 * for brand portal), FAILs are relabeled and their numeric details are
 * stripped — Andrew's directive: "never expose raw FAIL to brand users".
 *
 * Admins should call with `protectFails=false` to see the underlying truth.
 */
export interface BrandSafeView {
  badge: "PASS" | "FAIL" | "DAVR" | "MEASUREMENT" | "PENDING";
  badgeLabel: string;
  badgeClass: string;
  resultLabel: string | null;
  /** Helpful tooltip for the DAVR badge so brand users understand it. */
  hint: string | null;
}

export function toBrandSafeView(
  scored: ScoredTestRun,
  opts: { protectFails: boolean },
): BrandSafeView {
  const { rawStatus, resultLabel } = scored;

  if (rawStatus === "FAIL" && opts.protectFails) {
    return {
      badge: "DAVR",
      badgeLabel: "Dev & Validation",
      badgeClass: "bg-slate-100 text-slate-500 border border-slate-200",
      resultLabel: null,
      hint:
        "Development & Application Validation Result — iterative R&D data captured during the FUZE program. Results below the production threshold are tracked for engineering, not for product claims.",
    };
  }

  if (rawStatus === "PASS") {
    return {
      badge: "PASS",
      badgeLabel: "PASS",
      badgeClass: "bg-emerald-100 text-emerald-700",
      resultLabel,
      hint: null,
    };
  }
  if (rawStatus === "FAIL") {
    return {
      badge: "FAIL",
      badgeLabel: "FAIL",
      badgeClass: "bg-red-100 text-red-700",
      resultLabel,
      hint: null,
    };
  }
  if (rawStatus === "MEASUREMENT") {
    return {
      badge: "MEASUREMENT",
      badgeLabel: "Measured",
      badgeClass: "bg-violet-100 text-violet-700",
      resultLabel,
      hint: null,
    };
  }
  return {
    badge: "PENDING",
    badgeLabel: "Pending",
    badgeClass: "bg-slate-100 text-slate-400",
    resultLabel: null,
    hint: null,
  };
}
