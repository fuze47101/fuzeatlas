/**
 * Phase 14C — role-keyed education content cards.
 *
 * Each portal landing pulls from here to render "Here's what
 * you should know" tiles. Cards link to existing /education
 * pages or canonical anchors; URLs that don't exist yet are
 * tagged TODO so Andrew (or a follow-on cron) can fill them.
 */

export type RoleKey = "BRAND" | "FACTORY" | "DISTRIBUTOR" | "LAB" | "ADMIN";

export interface EducationCard {
  title: string;
  url: string;
  summary: string;
  audience: RoleKey[];
  /** TRUE if the destination page doesn't exist yet — surfaces a "Coming soon" pill in the UI. */
  todo?: boolean;
}

export const ROLE_EDUCATION: Record<RoleKey, EducationCard[]> = {
  BRAND: [
    {
      title: "Why FUZE outperforms leaching antimicrobials at lower dose",
      url: "/education#mechanism",
      summary:
        "FUZE metamaterial bonds to the fiber surface and kills on contact — no ions in the wash water, no PFAS, no regulatory drift.",
      audience: ["BRAND"],
    },
    {
      title: "Reading your Atlas test reports",
      url: "/education/reading-test-reports",
      summary:
        "What ICP Ag values mean. What an AB log reduction tells you. Which standard validates what.",
      audience: ["BRAND"],
      todo: true,
    },
    {
      title: "What ASTM E2149 means and why it's the right test",
      url: "/education#testing",
      summary:
        "Dynamic contact test, 24-hour incubation, Mueller Hinton low-sulfur broth, UV-only sterilization. The test designed for non-leaching antimicrobials.",
      audience: ["BRAND"],
    },
    {
      title: "Setting your FUZE spec — tier, cadence, protocol",
      url: "/brand-portal/spec",
      summary:
        "Pick the F1-F4 tier you require, set ICP cadence (every N batches or every X liters), attach your brand-specific protocol doc.",
      audience: ["BRAND"],
    },
    {
      title: "Reading your supply chain dashboard",
      url: "/brand-portal/supply-chain",
      summary:
        "Every factory in your supply chain, FUZE consumption per factory, test pass rate, ICP cadence compliance.",
      audience: ["BRAND"],
    },
    {
      title: "Performance Stack — F1, F2, F3, F4",
      url: "/education#performance-stack",
      summary:
        "F1 = 100 washes / F2 = 75 / F3 = 50 / F4 = 25. Pick the tier that matches your category and durability target.",
      audience: ["BRAND"],
    },
  ],

  FACTORY: [
    {
      title: "How to apply FUZE — exhaust, pad-dry-cure, spray",
      url: "/education/application",
      summary:
        "Three standard textile finishing methods. Pickup percentages, bath concentrations, padder settings, cure profiles.",
      audience: ["FACTORY"],
    },
    {
      title: "Reading the brand spec for your fabric",
      url: "/factory-portal/specs",
      summary:
        "Each brand stipulates a required tier + ICP cadence + protocol doc. Your job is to hit it.",
      audience: ["FACTORY"],
    },
    {
      title: "ICP cadence — what it means and how to comply",
      url: "/education/icp-cadence",
      summary:
        "Brands require a fresh ICP test every N production batches or every X liters consumed. Atlas flags overdue cadences automatically.",
      audience: ["FACTORY"],
      todo: true,
    },
    {
      title: "Submitting a fabric for testing",
      url: "/factory-portal/intake",
      summary:
        "Use the intake form for new fabrics; reuse the FUZE number for retests. Voice intake works on mobile.",
      audience: ["FACTORY"],
    },
    {
      title: "Ordering FUZE through your distributor",
      url: "/factory-portal/orders",
      summary:
        "Pricing tier inherited from your distributor agreement. Application validation auto-checks volume vs fabric mass.",
      audience: ["FACTORY"],
    },
    {
      title: "FUZE has no shelf life — stock indefinitely",
      url: "/education/storage",
      summary:
        "Standard 19L carboys, 32 carboys per gaylord. No expiration date. Store at ambient temperature in a dark location.",
      audience: ["FACTORY"],
      todo: true,
    },
  ],

  DISTRIBUTOR: [
    {
      title: "Restocking from FUZE HQ",
      url: "/distributor-portal/restock",
      summary:
        "Order carboys / gaylords / containers direct from FUZE Salt Lake City. International minimum: 1 gaylord (32 × 19L = 608L).",
      audience: ["DISTRIBUTOR"],
    },
    {
      title: "Fulfilling factory orders — application validation flags",
      url: "/distributor-portal/incoming",
      summary:
        "Each incoming order has been auto-checked against fabric mass + tier. Flags mean review-before-fulfill, not block.",
      audience: ["DISTRIBUTOR"],
    },
    {
      title: "Inventory and reorder thresholds",
      url: "/distributor-portal/inventory",
      summary:
        "Set reorder point + reorder quantity per inventory location. The auto-reorder cron (every 6h) drafts when stock dips.",
      audience: ["DISTRIBUTOR"],
    },
    {
      title: "Per-factory pricing tiers",
      url: "/distributor-portal/inventory",
      summary:
        "Assign each factory you supply to one of your 5 pricing tiers. Volume discounts via cross-factory rollup.",
      audience: ["DISTRIBUTOR"],
    },
    {
      title: "QR codes on shipments — what factories see",
      url: "/education/qr-shipment",
      summary:
        "Every shipment includes a QR sticker linking to SDS + COA for that batch. Factory scans on receive + on application.",
      audience: ["DISTRIBUTOR"],
      todo: true,
    },
  ],

  LAB: [
    {
      title: "FUZE protocol specifics — ASTM E2149, AATCC 100",
      url: "/education#testing",
      summary:
        "ASTM E2149 primary for F3/F4 — 24h incubation, Mueller Hinton low-sulfur, UV-only sterilization. AATCC 100 for F1/F2 density.",
      audience: ["LAB"],
    },
    {
      title: "ICP-MS only — why we never use ICP-OES",
      url: "/education/icp-mes",
      summary:
        "FUZE policy: every ICP measurement is ICP-MS. ICP-OES results are flagged by the AI review and rejected.",
      audience: ["LAB"],
      todo: true,
    },
    {
      title: "Uploading test reports to Atlas",
      url: "/lab-portal/upload",
      summary:
        "Drag-drop the PDF. Atlas auto-parses the result fields. Files saved even on 0% parse confidence — you can confirm later.",
      audience: ["LAB"],
    },
    {
      title: "Inter-lab variance: how Atlas compares your results",
      url: "/admin/inter-lab-variance",
      summary:
        "When the same fabric is tested at ≥2 labs, Atlas surfaces the variance. Known calibration patterns annotated.",
      audience: ["LAB"],
    },
    {
      title: "Lab credit ledger — referrals + invoicing",
      url: "/lab-portal/credits",
      summary:
        "When FUZE refers a customer to you, you accrue credit toward future FUZE-paid testing. Auto-applies on invoice.",
      audience: ["LAB"],
    },
    {
      title: "AI form wizard — auto-fill from fabric context",
      url: "/lab-portal/wizard",
      summary:
        "Pick a form template, paste the fabric/brand IDs, AI fills the obvious fields with confidence indicators. You review + submit.",
      audience: ["LAB"],
    },
  ],

  ADMIN: [
    {
      title: "Approving brand-visible test results",
      url: "/admin/lab-review",
      summary:
        "Monday review queue. AI anomaly review surfaces ASTM protocol deviations + AATCC initial-count issues + multi-day inconsistencies.",
      audience: ["ADMIN"],
    },
    {
      title: "Configuring brand pricing tier ladders",
      url: "/admin/brands",
      summary:
        "Per-brand discount ladder based on lifetime FUZE consumption across all factories. Updates trigger Notification fan-out.",
      audience: ["ADMIN"],
    },
    {
      title: "Monday lab review queue workflow",
      url: "/admin/lab-review",
      summary:
        "Walk the queue: schedule retest / approve with notation / notify factory + brand. Sunday 22:00 UTC email seeds the agenda.",
      audience: ["ADMIN"],
    },
    {
      title: "Command Center — live state of everything",
      url: "/admin/command-center",
      summary:
        "6 metric tiles, brand × factory cadence matrix, recent activity, distributor alerts, brand approval queues. 30s refresh.",
      audience: ["ADMIN"],
    },
    {
      title: "Supply chain globe — geocoded network",
      url: "/admin/command-center/globe",
      summary:
        "Three.js globe with pulsing factory nodes + animated shipment arcs. Run `npm run seed:geocode` once to populate.",
      audience: ["ADMIN"],
    },
    {
      title: "Predictive churn — what the score means",
      url: "/admin/brands",
      summary:
        "Nightly 03:00 UTC cron scores every CUSTOMER_WON brand using Claude + 90-day activity slice. Banner appears at >60.",
      audience: ["ADMIN"],
    },
  ],
};

export function cardsForRole(role: string): EducationCard[] {
  if (role === "BRAND_USER" || role === "BRAND_MANAGER") return ROLE_EDUCATION.BRAND;
  if (role === "FACTORY_USER" || role === "FACTORY_MANAGER") return ROLE_EDUCATION.FACTORY;
  if (role === "DISTRIBUTOR_USER") return ROLE_EDUCATION.DISTRIBUTOR;
  if (role === "LAB_USER" || role === "LAB_MANAGER") return ROLE_EDUCATION.LAB;
  if (role === "ADMIN" || role === "EMPLOYEE") return ROLE_EDUCATION.ADMIN;
  return [];
}
