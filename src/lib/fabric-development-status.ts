/**
 * Fabric.developmentStatus — shared enum, labels, colors, helpers.
 *
 * The workflow status Tina maintains in her per-brand spreadsheet.
 * Captures where a fabric sits in the development → trial → AM test →
 * bulk-production lifecycle. Distinct from FabricSubmission.status
 * (per-submission state) and from Fabric.labStatus (internal lab
 * pipeline).
 *
 * Added May 18 — SanMar spreadsheet replacement.
 */

export const FABRIC_DEV_STATUSES = [
  "NEW",
  "TRIAL_IN_PROGRESS",
  "TRIAL_COMPLETE",
  "AWAITING_AM_TEST",
  "AM_TESTING_FUZE_USA",
  "PROCEED_TO_BULK",
  "BULK_PRODUCTION",
  "DROPPED",
  "FURTHER_UPDATE_PENDING",
  "NO_FURTHER_UPDATE",
] as const;

export type FabricDevStatus = (typeof FABRIC_DEV_STATUSES)[number];

export const FABRIC_DEV_STATUS_LABEL: Record<FabricDevStatus, string> = {
  NEW: "NEW",
  TRIAL_IN_PROGRESS: "Trial in progress",
  TRIAL_COMPLETE: "Trial complete",
  AWAITING_AM_TEST: "Awaiting AM test",
  AM_TESTING_FUZE_USA: "AM testing at FUZE USA",
  PROCEED_TO_BULK: "Proceed with AM test",
  BULK_PRODUCTION: "Bulk Production",
  DROPPED: "Dropped",
  FURTHER_UPDATE_PENDING: "Further update?",
  NO_FURTHER_UPDATE: "No Further update",
};

export const FABRIC_DEV_STATUS_COLOR: Record<FabricDevStatus, { bg: string; text: string; border: string }> = {
  NEW: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-300" },
  TRIAL_IN_PROGRESS: { bg: "bg-sky-100", text: "text-sky-700", border: "border-sky-300" },
  TRIAL_COMPLETE: { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-300" },
  AWAITING_AM_TEST: { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-300" },
  AM_TESTING_FUZE_USA: { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-300" },
  PROCEED_TO_BULK: { bg: "bg-teal-100", text: "text-teal-700", border: "border-teal-300" },
  BULK_PRODUCTION: { bg: "bg-green-100", text: "text-green-800", border: "border-green-300" },
  DROPPED: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  FURTHER_UPDATE_PENDING: { bg: "bg-yellow-100", text: "text-yellow-700", border: "border-yellow-300" },
  NO_FURTHER_UPDATE: { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-300" },
};

export function isValidFabricDevStatus(value: unknown): value is FabricDevStatus {
  return typeof value === "string" && (FABRIC_DEV_STATUSES as readonly string[]).includes(value);
}

/**
 * Best-effort mapper from Tina's freetext status strings (in her
 * spreadsheets) to the canonical enum. Used by seed scripts and
 * import wizards.
 */
export function mapTinaStatusToEnum(s: string | null | undefined): FabricDevStatus | null {
  if (!s) return null;
  const n = s.trim().toLowerCase();
  if (n.includes("bulk")) return "BULK_PRODUCTION";
  if (n.includes("dropped")) return "DROPPED";
  if (n === "new") return "NEW";
  if (n.includes("am testing") && n.includes("fuze")) return "AM_TESTING_FUZE_USA";
  if (n.includes("proceed") && n.includes("am")) return "PROCEED_TO_BULK";
  if (n.includes("awaiting") && n.includes("am")) return "AWAITING_AM_TEST";
  if (n.includes("trial") && n.includes("complete")) return "TRIAL_COMPLETE";
  if (n.includes("trial") && n.includes("progress")) return "TRIAL_IN_PROGRESS";
  if (n.includes("no further")) return "NO_FURTHER_UPDATE";
  if (n.includes("further update")) return "FURTHER_UPDATE_PENDING";
  return null;
}
