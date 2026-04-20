// @ts-nocheck
/**
 * Typed shape of the WeeklyExecReport.snapshot JSON column.
 *
 * Keep this file the single source of truth for what a weekly snapshot
 * contains. The API and the page both import from here so a schema drift
 * between producer and consumer shows up as a type error, not a render
 * glitch three sections deep.
 *
 * Versioning: bump SNAPSHOT_VERSION whenever a field is removed or its
 * meaning changes. The renderer falls back gracefully for older versions.
 */

export const SNAPSHOT_VERSION = 1;

export interface SnapshotPeriod {
  /** ISO date, inclusive start of the window (UTC midnight). */
  start: string;
  /** ISO date, inclusive end of the window (UTC 23:59:59). */
  end: string;
  /** Number of days covered. 7 for a normal week, 14 for a backfill run. */
  days: number;
  /** The Monday anchor this report is filed under. */
  weekOf: string;
}

export interface Kpi {
  label: string;
  value: number | string;
  /** Display unit — "$", "L", "kg", "", "%". */
  unit?: string;
  /** Delta vs prior equivalent window, signed. `undefined` means "no comparison". */
  deltaPct?: number;
  /** One-line caption for the tile. */
  caption?: string;
  /** "good" | "warn" | "bad" | "neutral" — drives tile colour. */
  tone?: "good" | "warn" | "bad" | "neutral";
}

export interface SalesMetrics {
  bookedLiters: number;
  shippedLiters: number;
  bookedKg: number;
  shippedKg: number;
  bookedDollars: number;
  shippedDollars: number;
  newOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  byOrderType: Record<string, { count: number; dollars: number }>;
}

export interface SowRow {
  id: string;
  title: string | null;
  status: string;
  brandId: string;
  brandName: string;
  updatedAt: string;
  signatory?: string | null;
}

export interface SowMetrics {
  new: SowRow[];
  signed: SowRow[];
  active: SowRow[];
  complete: SowRow[];
  stale: SowRow[]; // DRAFT or SENT older than 30 days
  counts: { draft: number; sent: number; signed: number; active: number; complete: number; cancelled: number };
}

export interface BdStageCount {
  stage: string;
  count: number;
  deltaFromStart: number;
}

export interface BdLeaderboardRow {
  userId: string;
  userName: string;
  role: string;
  noteCount: number;
  brandsTouched: number;
  meetingsHeld: number;
}

export interface BdMetrics {
  stageWaterfall: BdStageCount[];
  leaderboard: BdLeaderboardRow[];
  handoffQueue: Array<{
    brandId: string;
    brandName: string;
    pipelineStage: string;
    handoffPending: boolean;
    lastActivityAt: string | null;
  }>;
  newBrands: Array<{ id: string; name: string; pipelineStage: string }>;
  atRisk: Array<{
    id: string;
    name: string;
    pipelineStage: string;
    lastActivityAt: string | null;
    daysSinceActivity: number | null;
  }>;
}

export interface TestingMetrics {
  completed: number;
  passed: number;
  failed: number;
  byType: Record<string, { total: number; passed: number; failed: number }>;
  recent: Array<{
    id: string;
    testType: string;
    brandName: string | null;
    fuzeFabricNumber: string | null;
    pass: boolean | null;
    testDate: string | null;
  }>;
}

export interface BuildMetrics {
  feedbackOpen: number;
  feedbackResolved: number;
  featuresShipped: Array<{
    id: string;
    title: string;
    resolvedAt: string;
    resolution: string | null;
  }>;
  // Free-form bullets the owner can edit inline (stored on execNote) —
  // the snapshot carries an initial auto-extracted list.
  buildNotes: string[];
}

export interface AgendaItem {
  id: string;
  kind: "meeting" | "task";
  title: string;
  brandName?: string | null;
  when: string;
  href: string;
}

export interface WeeklySnapshot {
  version: number;
  period: SnapshotPeriod;
  priorPeriod: SnapshotPeriod;
  kpis: Kpi[];
  sales: SalesMetrics;
  sows: SowMetrics;
  bd: BdMetrics;
  testing: TestingMetrics;
  build: BuildMetrics;
  customersAtRisk: BdMetrics["atRisk"];
  thisWeek: AgendaItem[];
  generatedAt: string;
}

/** Strong guard so the page never tries to render half-built snapshots. */
export function isWeeklySnapshot(x: any): x is WeeklySnapshot {
  return (
    x && typeof x === "object" &&
    typeof x.version === "number" &&
    x.period && x.kpis && x.sales && x.sows && x.bd && x.testing && x.build
  );
}
