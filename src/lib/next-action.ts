/**
 * Phase 14G — workflow inference heuristics.
 *
 * Pure function. Given an entity + its state, return a short list
 * of "what should this user do next?" suggestions. Used by the
 * <NextActionPanel /> on every detail page.
 *
 * Keep this dependency-free (no Prisma, no fetch). Callers pass in
 * pre-fetched state; this just does the if/else logic.
 */

export interface NextAction {
  kind: "set_spec" | "set_pricing_tiers" | "link_factory" | "submit_fabric"
    | "confirm_application" | "configure_test_pricing" | "run_geocoder"
    | "approve_pending" | "schedule_retest" | "review_anomalies"
    | "complete_onboarding";
  title: string;
  body: string;
  href: string;
  severity: "info" | "warn" | "error";
}

// ─── BRAND ──────────────────────────────────────────────────
interface BrandState {
  id: string;
  requiredFuzeTier?: string | null;
  icpCadenceEveryNBatches?: number | null;
  icpCadenceEveryLitersConsumed?: number | null;
  protocolDocUrl?: string | null;
  supplyChainLinkCount?: number;
  pricingTierCount?: number;
  pendingApprovalCount?: number;
}

export function nextActionsForBrand(b: BrandState): NextAction[] {
  const out: NextAction[] = [];
  const specMissing =
    !b.requiredFuzeTier &&
    !b.icpCadenceEveryNBatches &&
    !b.icpCadenceEveryLitersConsumed;
  if (specMissing) {
    out.push({
      kind: "set_spec",
      title: "Set the FUZE specification",
      body: "Pick a required tier (F1-F4) and ICP cadence. Every factory in your supply chain is held to this.",
      href: "/brand-portal/spec",
      severity: "error",
    });
  }
  if ((b.pricingTierCount ?? 0) === 0) {
    out.push({
      kind: "set_pricing_tiers",
      title: "Configure pricing tier ladder",
      body: "Set discount thresholds based on lifetime FUZE consumption across factories.",
      href: `/admin/brands/${b.id}`,
      severity: "warn",
    });
  }
  if ((b.supplyChainLinkCount ?? 0) === 0) {
    out.push({
      kind: "link_factory",
      title: "Link factories to your supply chain",
      body: "Add the factories you'd like to bring under your FUZE spec. Atlas auto-monitors cadence + approvals.",
      href: "/brand-portal/network",
      severity: "warn",
    });
  }
  if ((b.pendingApprovalCount ?? 0) > 0) {
    out.push({
      kind: "approve_pending",
      title: `${b.pendingApprovalCount} test result${b.pendingApprovalCount === 1 ? "" : "s"} awaiting your approval`,
      body: "Stamped brand-visible by FUZE Ops. Review and approve / reject from the approvals queue.",
      href: "/brand-portal/approvals",
      severity: "error",
    });
  }
  return out;
}

// ─── FACTORY ────────────────────────────────────────────────
interface FactoryState {
  id: string;
  supplyChainLinkCount?: number;
  pendingTestRequests?: number;
  overdueIcpCount?: number;
  brandRejectedCount?: number;
}

export function nextActionsForFactory(f: FactoryState): NextAction[] {
  const out: NextAction[] = [];
  if ((f.supplyChainLinkCount ?? 0) === 0) {
    out.push({
      kind: "link_factory",
      title: "No brand has linked this factory yet",
      body: "Once a brand adds your factory to their supply chain, you'll see their spec and required cadence here.",
      href: "/factory-portal/network",
      severity: "warn",
    });
  }
  if ((f.overdueIcpCount ?? 0) > 0) {
    out.push({
      kind: "submit_fabric",
      title: `${f.overdueIcpCount} fabric${f.overdueIcpCount === 1 ? "" : "s"} overdue for ICP test`,
      body: "Your brands' ICP cadence has been hit. Submit a fresh sample for testing to stay compliant.",
      href: "/factory-portal/intake",
      severity: "error",
    });
  }
  if ((f.brandRejectedCount ?? 0) > 0) {
    out.push({
      kind: "schedule_retest",
      title: `${f.brandRejectedCount} brand rejection${f.brandRejectedCount === 1 ? "" : "s"} to resolve`,
      body: "Brand has rejected a test result. Read the reason on each row and schedule a retest.",
      href: "/factory-portal/submissions",
      severity: "warn",
    });
  }
  if ((f.pendingTestRequests ?? 0) > 0) {
    out.push({
      kind: "submit_fabric",
      title: `${f.pendingTestRequests} test request${f.pendingTestRequests === 1 ? "" : "s"} in flight`,
      body: "Pending FUZE Ops or lab confirmation.",
      href: "/factory-portal/my-requests",
      severity: "info",
    });
  }
  return out;
}

// ─── LAB ────────────────────────────────────────────────────
interface LabState {
  id: string;
  labTestCount?: number;
  pendingTestRequests?: number;
  anomalyCount?: number;
  isFuzeOwned?: boolean;
}

export function nextActionsForLab(l: LabState): NextAction[] {
  const out: NextAction[] = [];
  if ((l.labTestCount ?? 0) === 0) {
    out.push({
      kind: "configure_test_pricing",
      title: "Configure your per-protocol pricing",
      body: "Add at least one row to the test catalog so FUZE Ops can quote against your lab.",
      href: "/lab-portal/lab-tests",
      severity: "warn",
    });
  }
  if ((l.pendingTestRequests ?? 0) > 0) {
    out.push({
      kind: "submit_fabric",
      title: `${l.pendingTestRequests} pending test request${l.pendingTestRequests === 1 ? "" : "s"} in your queue`,
      body: "Triage by priority + SLA. Higher priority = pin.",
      href: "/lab-portal/queue",
      severity: "info",
    });
  }
  if ((l.anomalyCount ?? 0) > 0) {
    out.push({
      kind: "review_anomalies",
      title: `${l.anomalyCount} AI-flagged result${l.anomalyCount === 1 ? "" : "s"} in the Monday queue`,
      body: "ASTM E2149 protocol or AATCC 100 initial-count deviations. Review before stamping brand-visible.",
      href: "/admin/lab-review",
      severity: "warn",
    });
  }
  return out;
}

// ─── DISTRIBUTOR ────────────────────────────────────────────
interface DistributorState {
  id: string;
  stockLitersOnHand: number;
  reorderPointLiters?: number | null;
  pendingIncomingCount?: number;
  hasInventoryRow?: boolean;
}

export function nextActionsForDistributor(d: DistributorState): NextAction[] {
  const out: NextAction[] = [];
  if (!d.hasInventoryRow) {
    out.push({
      kind: "configure_test_pricing",
      title: "Set your inventory + reorder threshold",
      body: "Once configured, Atlas auto-flags low stock and (if opted in) drafts a restock order.",
      href: "/distributor-portal/inventory",
      severity: "warn",
    });
  }
  if (
    d.reorderPointLiters != null &&
    d.stockLitersOnHand <= d.reorderPointLiters
  ) {
    out.push({
      kind: "submit_fabric",
      title: "FUZE stock at reorder threshold",
      body: `On hand ${d.stockLitersOnHand}L ≤ reorder point ${d.reorderPointLiters}L. Time to restock.`,
      href: "/distributor-portal/restock",
      severity: "error",
    });
  }
  if ((d.pendingIncomingCount ?? 0) > 0) {
    out.push({
      kind: "approve_pending",
      title: `${d.pendingIncomingCount} factory order${d.pendingIncomingCount === 1 ? "" : "s"} pending`,
      body: "Review application-validation flags before fulfilling.",
      href: "/distributor-portal/incoming",
      severity: "info",
    });
  }
  return out;
}
