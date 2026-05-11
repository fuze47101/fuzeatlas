"use client";

/**
 * /admin — IMP-3 (Phase 15).
 *
 * Replaces the legacy redirect-only landing with a proper admin
 * module picker. Pulls tiles from `src/lib/modules.ts` and shows
 * the modules most useful to a FUZE-Ops user landing at the
 * admin root.
 *
 * Non-admins are bounced to /home. Admins see a 6-tile grid
 * scoped to admin tools (Command Center + Globe + Sales &
 * Pipeline + Quality & Labs + Resources + Admin).
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { MODULES } from "@/lib/modules";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import Breadcrumbs from "@/components/Breadcrumbs";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import { ONBOARDING_CHECKLISTS } from "@/lib/onboarding-checklists";

const ADMIN_ROLES = new Set(["ADMIN", "EMPLOYEE", "SALES_MANAGER"]);

// Curated tile set most useful from the admin root. Pulls 6 modules
// already in MODULES; ordered by how often Andrew/Tina open them.
const ADMIN_LANDING_TILES = [
  { key: "operations", spotlight: "/admin/command-center" },
  { key: "sales-pipeline", spotlight: "/admin/brand-pipeline" },
  { key: "quality-labs", spotlight: "/admin/lab-review" },
  { key: "partners", spotlight: "/brands" },
  { key: "resources", spotlight: "/admin/weekly-review" },
  { key: "admin", spotlight: "/settings/users" },
];

export default function AdminLandingPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user === null) return; // still loading
    if (!user || !ADMIN_ROLES.has(user.role)) {
      router.replace("/home");
    }
  }, [user, router]);

  if (!user) return <LoadingSkeleton variant="page" label="Loading admin" />;
  if (!ADMIN_ROLES.has(user.role)) return null;

  const tiles = ADMIN_LANDING_TILES.map((t) => {
    const m = MODULES.find((x) => x.key === t.key);
    return m ? { ...m, spotlight: t.spotlight } : null;
  }).filter((m): m is NonNullable<typeof m> => !!m);

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <Breadcrumbs className="mb-2" items={[{ label: "Admin" }]} />
      <OnboardingChecklist
        surface="admin"
        items={ONBOARDING_CHECKLISTS.admin}
      />
      <h1 className="text-3xl sm:text-4xl font-black text-slate-900">
        Admin
      </h1>
      <p className="text-slate-600 mt-1 mb-6">
        FUZE-Ops control surfaces. Pick a module to dive in, or use the
        sidebar for the full nav.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiles.map((m) => (
          <Link
            key={m.key}
            href={m.landing}
            className="block rounded-2xl border border-slate-200 bg-white p-6 hover:border-[#00b4c3] hover:shadow-md transition-all focus-ring group"
          >
            <div className="flex items-start gap-4">
              <div
                className={`shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${m.accent} flex items-center justify-center text-2xl`}
              >
                {m.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-black text-slate-900">{m.label}</h2>
                <p className="text-sm text-slate-600 mt-1 leading-snug">{m.blurb}</p>
                <div className="mt-3 text-xs text-[#00b4c3] font-bold group-hover:underline">
                  Open {m.label} →
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link
          href="/admin/data-entry"
          className="rounded-xl border border-slate-200 bg-slate-50 p-4 hover:border-[#00b4c3] focus-ring"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Fast path</p>
          <p className="font-bold text-slate-900 mt-1">Data entry hub</p>
          <p className="text-xs text-slate-600 mt-1">
            Set brand spec, pricing tier, supply-chain link, lab pricing — all in one page.
          </p>
        </Link>
        <Link
          href="/admin/command-center"
          className="rounded-xl border border-slate-200 bg-slate-50 p-4 hover:border-[#00b4c3] focus-ring"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Live state</p>
          <p className="font-bold text-slate-900 mt-1">Command Center</p>
          <p className="text-xs text-slate-600 mt-1">
            Six metric tiles, brand × factory cadence matrix, recent activity, queues.
          </p>
        </Link>
        <Link
          href="/admin/lab-review"
          className="rounded-xl border border-slate-200 bg-slate-50 p-4 hover:border-[#00b4c3] focus-ring"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Weekly</p>
          <p className="font-bold text-slate-900 mt-1">Monday review queue</p>
          <p className="text-xs text-slate-600 mt-1">
            AI-flagged test runs + brand rejections. Sunday 22:00 UTC email seeds the agenda.
          </p>
        </Link>
      </div>
    </div>
  );
}
