/**
 * Phase 15 IMP-4 — per-portal onboarding checklists.
 *
 * Source of truth for the items each portal landing shows in
 * <OnboardingChecklist />. Items can be checked off manually
 * by the user OR auto-marked complete when a server-side
 * heuristic computes them done (e.g. brand has a profile row,
 * factory has placed an order, etc.). Manual checkmarks live
 * in UserOnboardingState.completedItems; auto-marks happen on
 * the surface as it loads.
 */

export interface ChecklistItem {
  id: string;
  label: string;
  hint?: string;
  href: string;
  /** Optional secondary link rendered under the item (e.g. a reference doc). */
  secondaryHref?: string;
  secondaryLabel?: string;
}

export type Surface =
  | "brand-portal"
  | "factory-portal"
  | "distributor-portal"
  | "lab-portal"
  | "admin";

export const ONBOARDING_CHECKLISTS: Record<Surface, ChecklistItem[]> = {
  "brand-portal": [
    {
      id: "confirm-profile",
      label: "Confirm your brand profile",
      hint: "Logo, headline, primary color — what your storefront shows.",
      href: "/brand-portal/profile",
    },
    {
      id: "link-factory",
      label: "Add at least one factory to your supply chain",
      hint: "Factories you'd like under your FUZE program.",
      href: "/brand-portal/supply-chain",
    },
    {
      id: "upload-protocol",
      label: "Upload your testing protocol PDF",
      hint: "Stored on your spec; auto-attached to lab handoffs.",
      href: "/brand-portal/spec",
      secondaryHref: "/education/testing-protocol",
      secondaryLabel: "FUZE recommended testing and protocol",
    },
    {
      id: "invite-team",
      label: "Invite a teammate",
      hint: "Brand managers can approve test results + edit the spec.",
      href: "/brand-portal/team",
    },
    // Item 14 — set-spec moved to the bottom of the checklist.
    {
      id: "set-spec",
      label: "Set required FUZE tier + ICP cadence",
      hint: "Every factory in your supply chain is held to this spec.",
      href: "/brand-portal/spec",
    },
  ],
  "factory-portal": [
    {
      id: "confirm-profile",
      label: "Confirm your factory profile",
      hint: "Capabilities, address, FUZE-application equipment.",
      href: "/factory-portal",
    },
    {
      id: "first-submission",
      label: "Submit your first fabric",
      hint: "Use the intake form — voice intake works on mobile.",
      href: "/factory-portal/intake",
    },
    {
      id: "link-distributor",
      label: "Set up your distributor relationship",
      hint: "Pricing tier inherits from your distributor agreement.",
      href: "/factory-portal/network",
    },
    {
      id: "first-fuze-order",
      label: "Place your first FUZE order",
      hint: "Goes through your distributor at their tier.",
      href: "/factory-portal/orders",
    },
    {
      id: "first-test-upload",
      label: "Upload a recent test report",
      hint: "Drag-drop the PDF; the parser handles the rest.",
      href: "/factory-portal/upload-report",
    },
  ],
  "distributor-portal": [
    {
      id: "confirm-profile",
      label: "Confirm your distributor profile + warehouse",
      hint: "Address, country, alias names if any.",
      href: "/distributor-portal",
    },
    {
      id: "set-tiers",
      label: "Set your local pricing tiers",
      hint: "5-rung default in your local currency. Assign factories.",
      href: "/distributor-portal/inventory",
    },
    {
      id: "add-factories",
      label: "Add the factories you serve",
      hint: "Map each factory to one of your pricing tiers.",
      href: "/distributor-portal/inventory",
    },
    {
      id: "first-restock",
      label: "Place your first restock order",
      hint: "Carboys / gaylords / containers from FUZE HQ in SLC.",
      href: "/distributor-portal/restock",
    },
    {
      id: "upload-shipment",
      label: "Upload a shipment confirmation",
      hint: "BOL or COA so factories can verify on receive.",
      href: "/distributor-portal/documents",
    },
  ],
  "lab-portal": [
    {
      id: "confirm-profile",
      label: "Confirm your lab profile + accreditations",
      hint: "ISO 17025 / TAF / CNAS so we route the right tests to you.",
      href: "/lab-portal/profile",
    },
    {
      id: "set-pricing",
      label: "Set per-test pricing and turnaround",
      hint: "Per protocol — FUZE cost + published price + SLA days.",
      href: "/lab-portal/lab-tests",
    },
    {
      id: "pick-up-request",
      label: "Pick up your first test request",
      hint: "Triage by priority + SLA from the queue.",
      href: "/lab-portal/queue",
    },
    {
      id: "first-result",
      label: "Submit your first result with raw data",
      hint: "Drag-drop the PDF; AI auto-extracts the result fields.",
      href: "/lab-portal/upload",
    },
    {
      id: "set-timezone",
      label: "Set your timezone for cadence emails",
      hint: "Quiet-hours-aware so Tina doesn't get pinged at 3am.",
      href: "/settings/profile",
    },
  ],
  admin: [
    {
      id: "command-center",
      label: "Visit the Command Center",
      hint: "Six metric tiles + brand × factory cadence matrix.",
      href: "/admin/command-center",
    },
    {
      id: "geocode",
      label: "Run the supply-chain geocoder",
      hint: "`npm run seed:geocode` — populates lat/lng for the globe.",
      href: "/admin/command-center/globe",
    },
    {
      id: "lab-review",
      label: "Walk the Monday review queue",
      hint: "Sunday 22:00 UTC email seeds the agenda.",
      href: "/admin/lab-review",
    },
    {
      id: "data-entry",
      label: "Bookmark the data-entry hub",
      hint: "Mini-forms for brand spec, pricing tier, supply chain link.",
      href: "/admin/data-entry",
    },
    {
      id: "audit-log",
      label: "Visit the audit log",
      hint: "Who changed what + when, across every entity.",
      href: "/settings/audit-log",
    },
  ],
};

export function checklistForRole(role: string): { surface: Surface; items: ChecklistItem[] } | null {
  if (role === "BRAND_USER" || role === "BRAND_MANAGER") return { surface: "brand-portal", items: ONBOARDING_CHECKLISTS["brand-portal"] };
  if (role === "FACTORY_USER" || role === "FACTORY_MANAGER") return { surface: "factory-portal", items: ONBOARDING_CHECKLISTS["factory-portal"] };
  if (role === "DISTRIBUTOR_USER") return { surface: "distributor-portal", items: ONBOARDING_CHECKLISTS["distributor-portal"] };
  if (role === "LAB_USER" || role === "LAB_MANAGER") return { surface: "lab-portal", items: ONBOARDING_CHECKLISTS["lab-portal"] };
  if (role === "ADMIN" || role === "EMPLOYEE") return { surface: "admin", items: ONBOARDING_CHECKLISTS.admin };
  return null;
}
