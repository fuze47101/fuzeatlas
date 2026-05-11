"use client";

/**
 * <OnboardingWizard role={...} userId={...} /> — Phase 14E.
 *
 * Mounted at the top of each portal landing. Reads
 * User.onboardingCompletedAt (passed in from the parent); if null,
 * renders the per-role wizard. POSTs to /api/me/onboarding to
 * persist step state + flip completed flag on finish.
 *
 * The wizard is dismiss-able. Dismissing flips completed:
 * the user can always re-enter via /settings/profile.
 */
import { useState } from "react";

type RoleKey = "BRAND" | "FACTORY" | "DISTRIBUTOR" | "LAB" | "ADMIN";

interface Step {
  key: string;
  title: string;
  body: string;
  cta: { label: string; href: string };
}

const STEPS: Record<RoleKey, Step[]> = {
  BRAND: [
    {
      key: "spec",
      title: "Set your FUZE specification",
      body: "Pick the F1-F4 tier you require + ICP cadence. Every factory in your supply chain will be held to this.",
      cta: { label: "Open spec form →", href: "/brand-portal/spec" },
    },
    {
      key: "supply-chain",
      title: "Link your factories",
      body: "Add the factories you'd like to bring under your FUZE spec. Atlas auto-monitors cadence + approvals.",
      cta: { label: "Manage supply chain →", href: "/brand-portal/network" },
    },
    {
      key: "team",
      title: "Invite your team",
      body: "Add brand managers (full access) or brand viewers (read-only) to collaborate on Atlas.",
      cta: { label: "Manage team →", href: "/brand-portal/team" },
    },
  ],
  FACTORY: [
    {
      key: "profile",
      title: "Confirm your factory profile",
      body: "Verify your address, capacity, and FUZE-application capabilities are accurate.",
      cta: { label: "Open profile →", href: "/factory-portal" },
    },
    {
      key: "specs",
      title: "Review your brand specs",
      body: "Each brand stipulates a required tier + ICP cadence. Make sure your operations team has seen them.",
      cta: { label: "View specs →", href: "/factory-portal/specs" },
    },
    {
      key: "first-order",
      title: "Place your first FUZE order",
      body: "Order goes through your distributor at their pricing tier. Application validation auto-checks the math.",
      cta: { label: "Order FUZE →", href: "/factory-portal/orders" },
    },
  ],
  DISTRIBUTOR: [
    {
      key: "inventory",
      title: "Confirm your stock + reorder threshold",
      body: "Set the on-hand FUZE liters and the reorder point. Atlas auto-flags low stock.",
      cta: { label: "Inventory →", href: "/distributor-portal/inventory" },
    },
    {
      key: "factories",
      title: "Link your active factories",
      body: "Assign each factory you supply to one of your 5 pricing tiers.",
      cta: { label: "Open inventory →", href: "/distributor-portal/inventory" },
    },
    {
      key: "first-restock",
      title: "Place your first restock order",
      body: "Order carboys / gaylords / containers direct from FUZE HQ in SLC.",
      cta: { label: "Restock →", href: "/distributor-portal/restock" },
    },
  ],
  LAB: [
    {
      key: "catalog",
      title: "Set your test catalog with FUZE pricing",
      body: "Add at least one per-protocol row with FUZE cost + your published price.",
      cta: { label: "Configure catalog →", href: "/lab-portal/lab-tests" },
    },
    {
      key: "profile",
      title: "Confirm your ops contact + accreditations",
      body: "Day-to-day point of contact + ISO 17025 / TAF / CNAS credentials.",
      cta: { label: "Open profile →", href: "/lab-portal/profile" },
    },
    {
      key: "first-upload",
      title: "Upload your first test report",
      body: "Drag-drop the PDF. Atlas auto-parses the result fields.",
      cta: { label: "Upload →", href: "/lab-portal/upload" },
    },
  ],
  ADMIN: [
    {
      key: "command-center",
      title: "Visit the Command Center",
      body: "Six metric tiles + brand × factory cadence matrix + recent activity. Live state of everything.",
      cta: { label: "Open Command Center →", href: "/admin/command-center" },
    },
    {
      key: "command-center-globe",
      title: "Visit the supply-chain globe",
      body: "Three.js globe with pulsing factory nodes + animated shipment arcs. Run `npm run seed:geocode` once.",
      cta: { label: "Open globe →", href: "/admin/command-center/globe" },
    },
    {
      key: "lab-review",
      title: "Walk the Monday review queue",
      body: "AI-flagged test runs + brand rejections. Sunday 22:00 UTC email seeds the agenda.",
      cta: { label: "Open queue →", href: "/admin/lab-review" },
    },
  ],
};

export default function OnboardingWizard({
  role,
  completedAt,
}: {
  role: string;
  completedAt: string | null;
}) {
  const [dismissed, setDismissed] = useState(!!completedAt);
  const [stepIdx, setStepIdx] = useState(0);

  const roleKey: RoleKey | null =
    role === "BRAND_USER" || role === "BRAND_MANAGER" ? "BRAND" :
    role === "FACTORY_USER" || role === "FACTORY_MANAGER" ? "FACTORY" :
    role === "DISTRIBUTOR_USER" ? "DISTRIBUTOR" :
    role === "LAB_USER" || role === "LAB_MANAGER" ? "LAB" :
    role === "ADMIN" || role === "EMPLOYEE" ? "ADMIN" :
    null;

  if (dismissed || !roleKey) return null;
  const steps = STEPS[roleKey];
  const step = steps[stepIdx];
  const isLast = stepIdx === steps.length - 1;

  async function finish(skipped: boolean) {
    setDismissed(true);
    try {
      await fetch("/api/me/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completed: true,
          state: { lastStepIdx: stepIdx, skipped },
        }),
      });
    } catch {
      // best-effort; UI already dismissed
    }
  }

  return (
    <div className="rounded-xl border border-[#00b4c3] bg-gradient-to-br from-[#00b4c3]/5 to-white p-5 mb-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-[#00b4c3] mb-1">
            Welcome — let's get you set up
          </p>
          <h2 className="text-lg font-black text-slate-900">{step.title}</h2>
          <p className="text-sm text-slate-700 mt-2">{step.body}</p>
          <div className="flex items-center gap-3 mt-4">
            <a
              href={step.cta.href}
              className="px-4 py-2 rounded bg-[#00b4c3] text-white text-sm font-bold hover:bg-[#009aa8] focus-ring"
            >
              {step.cta.label}
            </a>
            {!isLast && (
              <button
                onClick={() => setStepIdx(stepIdx + 1)}
                className="px-3 py-2 text-sm text-slate-700 hover:text-slate-900 focus-ring rounded"
              >
                Next step →
              </button>
            )}
            {isLast && (
              <button
                onClick={() => finish(false)}
                className="px-3 py-2 text-sm text-emerald-700 hover:text-emerald-900 font-bold focus-ring rounded"
              >
                Mark complete ✓
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 mt-3">
            {steps.map((s, i) => (
              <span
                key={s.key}
                className={`h-1.5 rounded-full flex-1 ${
                  i <= stepIdx ? "bg-[#00b4c3]" : "bg-slate-200"
                }`}
              />
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Step {stepIdx + 1} of {steps.length}
          </p>
        </div>
        <button
          onClick={() => finish(true)}
          className="text-slate-400 hover:text-slate-600 text-xl leading-none focus-ring rounded px-2"
          aria-label="Dismiss welcome wizard"
          title="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
