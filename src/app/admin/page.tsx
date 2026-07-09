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
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { MODULES } from "@/lib/modules";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import Breadcrumbs from "@/components/Breadcrumbs";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import { ONBOARDING_CHECKLISTS } from "@/lib/onboarding-checklists";
import { useI18n } from "@/i18n";

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

type AlertItem = {
  key: string;
  label: string;
  count: number;
  link: string;
  tone: "red";
};

/**
 * Prominent RED banner at the very top of /admin listing every
 * actionable queue nobody is watching. Auto-refreshes every 60s.
 * Fold-in for the older amber orphan banner — orphan reports are
 * now one of six alert categories.
 */
function AdminAlertBanner() {
  const [items, setItems] = useState<AlertItem[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch("/api/admin/alerts", { cache: "no-store" });
        const d = await r.json();
        if (cancelled) return;
        if (d.ok) {
          setItems(d.items || []);
          setTotal(d.total ?? 0);
        }
      } catch {
        // silent — banner just doesn't render on network flake
      }
    };
    load();
    const timer = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (total === null || items === null) return null;
  if (total === 0) {
    return (
      <div className="mb-6 flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-4 py-2 text-xs text-slate-500">
        <span className="text-emerald-600 text-sm">✓</span>
        <span>All queues clear — no action-required items right now.</span>
      </div>
    );
  }
  return (
    <div className="mb-6 rounded-xl border-2 border-rose-400 bg-rose-50 shadow-sm">
      <div className="px-5 pt-4 pb-2 flex items-center gap-3">
        <span className="text-2xl">⚠</span>
        <p className="text-rose-900 font-black text-lg sm:text-xl">
          {total} item{total === 1 ? "" : "s"} need attention — action required
        </p>
      </div>
      <div className="px-5 pb-4 flex flex-wrap gap-2">
        {items.map((i) => (
          <Link
            key={i.key}
            href={i.link}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm hover:bg-rose-100 transition-colors focus-ring"
          >
            <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-rose-600 text-white text-xs font-black">
              {i.count}
            </span>
            <span className="text-rose-900 font-semibold">{i.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function AdminLandingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useI18n();
  const T = t.adminLanding;

  useEffect(() => {
    if (user === null) return; // still loading
    if (!user || !ADMIN_ROLES.has(user.role)) {
      router.replace("/home");
    }
  }, [user, router]);

  if (!user) return <LoadingSkeleton variant="page" label={T.loadingLabel} />;
  if (!ADMIN_ROLES.has(user.role)) return null;

  const tiles = ADMIN_LANDING_TILES.map((t) => {
    const m = MODULES.find((x) => x.key === t.key);
    return m ? { ...m, spotlight: t.spotlight } : null;
  }).filter((m): m is NonNullable<typeof m> => !!m);

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <AdminAlertBanner />
      <Breadcrumbs className="mb-2" items={[{ label: T.crumb }]} />
      <OnboardingChecklist
        surface="admin"
        items={ONBOARDING_CHECKLISTS.admin}
      />
      <h1 className="text-3xl sm:text-4xl font-black text-slate-900">
        {T.heading}
      </h1>
      <p className="text-slate-600 mt-1 mb-6">
        {T.subtitle}
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
                  {T.openPrefix} {m.label} →
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
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{T.fastPathLabel}</p>
          <p className="font-bold text-slate-900 mt-1">{T.dataEntryHubTitle}</p>
          <p className="text-xs text-slate-600 mt-1">
            {T.dataEntryHubBody}
          </p>
        </Link>
        <Link
          href="/admin/command-center"
          className="rounded-xl border border-slate-200 bg-slate-50 p-4 hover:border-[#00b4c3] focus-ring"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{T.liveStateLabel}</p>
          <p className="font-bold text-slate-900 mt-1">{T.commandCenterTitle}</p>
          <p className="text-xs text-slate-600 mt-1">
            {T.commandCenterBody}
          </p>
        </Link>
        <Link
          href="/admin/lab-review"
          className="rounded-xl border border-slate-200 bg-slate-50 p-4 hover:border-[#00b4c3] focus-ring"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{T.weeklyLabel}</p>
          <p className="font-bold text-slate-900 mt-1">{T.mondayReviewTitle}</p>
          <p className="text-xs text-slate-600 mt-1">
            {T.mondayReviewBody}
          </p>
        </Link>
      </div>
    </div>
  );
}
