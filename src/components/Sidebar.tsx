"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import FuzeLogo from "./FuzeLogo";
import { NotificationBell } from "./NotificationBell";
import { useI18n, LOCALES } from "@/i18n";
import type { Locale } from "@/i18n";
import { useAuth } from "@/lib/AuthContext";
import ViewAsSwitcher from "./ViewAsSwitcher";
import {
  MODULES,
  findActiveModule,
  type ModuleDef,
  type ModuleItem,
  type ModuleHint,
} from "@/lib/modules";

/**
 * ═══════════════════════════════════════════════════════════════
 *  SIDEBAR — scoped to the active module
 *
 *  Internal users (admin / employee / sales):
 *    • On /home → we show the compact module picker (6 buttons).
 *      Sidebar is intentionally minimal so the 6 cards are the star.
 *    • On any module page → sidebar is scoped to JUST that module's
 *      items with a big "← All Modules" link back to /home.
 *    • Data comes from `@/lib/modules` — the same source of truth
 *      the home page cards use. No more drift.
 *
 *  External portal users (brand, factory, distributor, lab) keep
 *  their dedicated portal navs — they never see the module picker.
 * ═══════════════════════════════════════════════════════════════
 */

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  EMPLOYEE: "Employee",
  SALES_MANAGER: "Sales Manager",
  SALES_REP: "Sales Rep",
  FABRIC_MANAGER: "Fabric Manager",
  TESTING_MANAGER: "Testing Manager",
  FACTORY_MANAGER: "Factory Manager",
  FACTORY_USER: "Factory",
  BRAND_USER: "Brand",
  DISTRIBUTOR_USER: "Distributor",
  LAB_USER: "Lab",
  PUBLIC: "Public",
};

interface NavItem {
  href: string;
  label: string;
  icon: string;
  // Phase 16 i18n — points into t.modules[labelKey]. Falls back to
  // the English `label` when missing or the locale lacks the key.
  labelKey?: string;
  badge?: number;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  // Phase 16 i18n — labelKey-aware. Falls back to the English `label`
  // when labelKey is absent or the active locale doesn't have it.
  const { t } = useI18n();
  const mods = (t as any).modules || {};
  const shown = (item.labelKey && mods[item.labelKey]) || item.label;
  const active = pathname === item.href || pathname.startsWith(item.href + "/");
  return (
    <Link
      href={item.href}
      className={`
        flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all
        ${
          active
            ? "bg-[#00b4c3] text-white shadow-lg shadow-[#00b4c3]/30"
            : "text-slate-300 hover:bg-slate-800 hover:text-white"
        }
      `}
    >
      <span className="text-base">{item.icon}</span>
      <span className="flex-1">{shown}</span>
      {item.badge && item.badge > 0 ? (
        <span
          className={`min-w-[20px] h-5 flex items-center justify-center rounded-full text-[10px] font-bold px-1.5 ${
            active ? "bg-white/25 text-white" : "bg-red-500 text-white animate-pulse"
          }`}
        >
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}

function NavSection({
  group,
  pathname,
  expanded,
  onToggle,
}: {
  group: NavGroup;
  pathname: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasActive = group.items.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/"),
  );
  const groupBadgeTotal = group.items.reduce((sum, item) => sum + (item.badge || 0), 0);

  return (
    <div>
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
          hasActive ? "text-[#00b4c3]" : "text-slate-500 hover:text-slate-300"
        }`}
      >
        <span className="flex items-center gap-2">
          {group.label}
          {!expanded && groupBadgeTotal > 0 && (
            <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-1 animate-pulse">
              {groupBadgeTotal}
            </span>
          )}
        </span>
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="mt-0.5 space-y-0.5">
          {group.items.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const { locale, setLocale, t } = useI18n();
  const { user, logout, impersonation, loading } = useAuth();

  const isBrandUser = user?.role === "BRAND_USER";
  const isFactoryUser = user?.role === "FACTORY_USER" || user?.role === "FACTORY_MANAGER";
  const isDistributorUser = user?.role === "DISTRIBUTOR_USER";
  const isLabUser = user?.role === "LAB_USER";
  const isInternal =
    !isBrandUser && !isFactoryUser && !isDistributorUser && !isLabUser && user?.role !== "PUBLIC";
  const isAdmin = (user?.role === "ADMIN" || user?.role === "EMPLOYEE") && !impersonation?.active;

  // ─── Pending counts (for internal admin badges) ─────
  const [pendingCounts, setPendingCounts] = useState<{
    accessRequests: number;
    testRequests: number;
    total: number;
  }>({ accessRequests: 0, testRequests: 0, total: 0 });

  useEffect(() => {
    if (!isAdmin) return;
    const fetchCounts = () => {
      fetch("/api/admin/pending-counts")
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) setPendingCounts(d);
        })
        .catch(() => {});
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  // ─── Module hint for brand detail pages ───────────
  //
  // /brands/[id] is formally owned by the Partners module in modules.ts,
  // but when a BD rep opens a LEAD / PRESENTATION they're still prospecting —
  // the sidebar should stay in Business Development. We peek at the brand's
  // pipelineStage via a tiny endpoint and use it as a hint for findActiveModule.
  //
  // Guard: only BD-relevant stages steer the hint; everything else falls through
  // to the default prefix match (Partners).
  const [brandModuleHint, setBrandModuleHint] = useState<ModuleHint>(null);
  useEffect(() => {
    const m = pathname.match(/^\/brands\/([^/]+)/);
    if (!m) {
      if (brandModuleHint !== null) setBrandModuleHint(null);
      return;
    }
    const brandId = m[1];
    if (brandId === "new") {
      if (brandModuleHint !== null) setBrandModuleHint(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/brands/${brandId}/stage-mini`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        // Only LEAD stage brands belong to Business Development. Once a lead
        // moves to PRESENTATION (or any downstream stage) they're a Partner and
        // the sidebar should scope to the Partners module.
        if (d.ok && d.pipelineStage === "LEAD") {
          setBrandModuleHint("business-development");
        } else {
          setBrandModuleHint(null);
        }
      })
      .catch(() => {
        if (!cancelled) setBrandModuleHint(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // ─── Lab pending counts ─────────────────────────────
  const [labPendingCount, setLabPendingCount] = useState(0);
  useEffect(() => {
    if (!isLabUser) return;
    const fetchLabCounts = () => {
      fetch("/api/lab-portal")
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) setLabPendingCount(d.stats?.pendingRequests || 0);
        })
        .catch(() => {});
    };
    fetchLabCounts();
    const interval = setInterval(fetchLabCounts, 30000);
    return () => clearInterval(interval);
  }, [isLabUser]);

  // ─── Top link (per role) ────────────────────────────
  const topItem: NavItem = isFactoryUser
    ? { href: "/factory-portal", label: t.nav.dashboard, icon: "📊" }
    : isBrandUser
      ? { href: "/brand-portal", label: t.nav.dashboard, icon: "📊" }
      : isDistributorUser
        ? { href: "/distributor-portal", label: t.nav.dashboard, icon: "📊" }
        : isLabUser
          ? { href: "/lab-portal", label: t.nav.dashboard, icon: "📊" }
          : { href: "/home", label: t.nav.home || "Home", icon: "🏠" };

  // ═══════════════════════════════════════════════════════════════
  //  Build the nav based on role + current pathname
  // ═══════════════════════════════════════════════════════════════
  let groups: NavGroup[] = [];
  let scopedModule: ModuleDef | undefined;
  const onHome = pathname === "/home";

  if (isBrandUser) {
    groups = [
      {
        label: t.nav.groupMyProgram || "My Program",
        items: [
          { href: "/brand-portal/fabrics", label: "Fabrics", labelKey: "fabrics", icon: "🧵" },
          { href: "/brand-portal/submissions", label: "Submissions", labelKey: "submissions", icon: "📋" },
          { href: "/brand-portal/tests", label: "Test Results", labelKey: "testResults", icon: "🧪" },
          { href: "/brand-portal/contacts", label: "Contacts", labelKey: "contacts", icon: "👥" },
        ],
      },
      {
        label: t.nav.groupResources || "Resources",
        items: [
          { href: "/fabric-library", label: "FUZE Fabric Library", labelKey: "fuzeFabricLibrary", icon: "📚" },
          { href: "/compliance-library", label: "Document Center", labelKey: "documentCenter", icon: "📋" },
          { href: "/book-meeting", label: "Book Meeting", labelKey: "bookMeeting", icon: "📅" },
          { href: "/brand-portal/chat", label: "FUZE FAQ", labelKey: "fuzeAiFaq", icon: "💬" },
          { href: "/factories", label: "Factory Search", labelKey: "factorySearch", icon: "🔍" },
          { href: "/pricing", label: "Pricing & Environment", labelKey: "pricingEnvironment", icon: "💰" },
          { href: "/pricing/calculator", label: "Application Calculator", labelKey: "applicationCalculator", icon: "🧮" },
          { href: "/sustainability", label: "Sustainability", labelKey: "sustainability", icon: "🌍" },
          { href: "/admin/esg-reports", label: "ESG Impact Report", labelKey: "esgImpactReport", icon: "🌱" },
        ],
      },
    ];
  } else if (isFactoryUser) {
    groups = [
      {
        label: t.nav.groupFactoryPortal || "Factory Portal",
        items: [
          { href: "/factory-portal/intake", label: "Submit Fabric", labelKey: "submitFabric", icon: "📥" },
          { href: "/factory-portal/fabrics", label: "Fabrics & Submissions", labelKey: "fabricsAndSubmissions", icon: "🧵" },
          { href: "/factory-portal/tests", label: "Test Results", labelKey: "testResults", icon: "🧪" },
          { href: "/factory-portal/upload-report", label: "Upload Test Report", labelKey: "uploadTestReport", icon: "📤" },
          { href: "/factory-portal/sample-trial", label: "Sample Trials", labelKey: "sampleTrials", icon: "🧪" },
          { href: "/factory-portal/request-test", label: "Request Test", labelKey: "requestTest", icon: "📋" },
          { href: "/factory-portal/my-requests", label: "My Requests", labelKey: "myRequests", icon: "📦" },
          { href: "/factory-portal/orders", label: "Order FUZE", labelKey: "orderFuze", icon: "🛒" },
        ],
      },
      {
        label: t.nav.groupResources || "Resources",
        items: [
          { href: "/fabric-library", label: "FUZE Fabric Library", labelKey: "fuzeFabricLibrary", icon: "📚" },
          { href: "/compliance-library", label: "Document Center", labelKey: "documentCenter", icon: "📋" },
          { href: "/pricing", label: "Pricing", labelKey: "pricing", icon: "💰" },
          { href: "/pricing/calculator", label: "Application Calculator", labelKey: "applicationCalculator", icon: "🧮" },
          { href: "/sustainability", label: "Sustainability", labelKey: "sustainability", icon: "🌱" },
          { href: "/brand-portal/chat", label: "FUZE FAQ", labelKey: "fuzeAiFaq", icon: "💬" },
        ],
      },
    ];
  } else if (isDistributorUser) {
    groups = [
      {
        label: t.nav.groupDistributorPortal || "Distributor Portal",
        items: [
          { href: "/distributor-portal/restock", label: "Restock from FUZE", labelKey: "restockFromFuze", icon: "💧" },
          { href: "/distributor-portal/orders", label: "Factory Orders", labelKey: "factoryOrders", icon: "📦" },
          {
            href: "/distributor-portal/incoming-orders",
            label: "Sub-Distributor Orders",
            labelKey: "subDistributorOrders",
            icon: "📥",
          },
          { href: "/distributor-portal/inventory", label: "Inventory & Pricing", labelKey: "inventoryPricing", icon: "📊" },
          { href: "/distributor-portal/fabrics", label: "Fabric Portfolio", labelKey: "fabricPortfolio", icon: "📒" },
          { href: "/distributor-portal/test-request", label: "Apply for Test", labelKey: "applyForTest", icon: "🧪" },
          { href: "/distributor-portal/upload-report", label: "Upload Test Report", labelKey: "uploadTestReport", icon: "📤" },
          { href: "/distributor-portal/test-reports", label: "Test Reports", labelKey: "testReports", icon: "🔬" },
          { href: "/distributor-portal/documents", label: "Document Library", labelKey: "documentLibrary", icon: "📂" },
          { href: "/distributor-portal/invoices", label: "Invoices", labelKey: "invoices", icon: "📄" },
        ],
      },
      // "High tide raises all boats" — distributor-side BD reps
      // (Jeremy, Kathir, Tandy, Scott Smith) need the wizard + the
      // scoreboard in their sidebar so they can run outreach for FUZE
      // alongside their distributor day-jobs. Pure distributors (Danny,
      // etc.) should NOT see these. Gate on user.canClaim — the flag
      // we already use to mark BD-eligible non-admin users. Danny's
      // canClaim is false; Jeremy/Kathir/Tandy/Scott's is true.
      ...(user?.canClaim
        ? [
            {
              label: t.nav.groupBizDev || "Business Development",
              items: [
                { href: "/admin/bd/wizard", label: "BD Wizard", labelKey: "bdWizard", icon: "🪄" },
                { href: "/admin/bd/scoreboard", label: "BD Scoreboard", labelKey: "bdScoreboard", icon: "📊" },
                { href: "/admin/brand-pipeline", label: "Brand Pipeline (Leads)", labelKey: "brandPipelineLeads", icon: "🔥" },
                { href: "/recipe-search", label: "Recipe Search", labelKey: "recipeSearch", icon: "🔎" },
              ],
            },
          ]
        : []),
      {
        label: t.nav.groupResources || "Resources",
        items: [
          { href: "/fabric-library", label: "FUZE Fabric Library", labelKey: "fuzeFabricLibrary", icon: "📚" },
          { href: "/compliance-library", label: "Document Center", labelKey: "documentCenter", icon: "📋" },
          { href: "/pricing", label: "Pricing", labelKey: "pricing", icon: "💰" },
          { href: "/sustainability", label: "Sustainability", labelKey: "sustainability", icon: "🌱" },
          { href: "/brand-portal/chat", label: "FUZE FAQ", labelKey: "fuzeAiFaq", icon: "💬" },
        ],
      },
    ];
  } else if (isLabUser) {
    groups = [
      {
        label: t.nav.groupLabPortal || "Lab Portal",
        items: [
          { href: "/lab-portal/catalog", label: "Test Catalog", labelKey: "testCatalog", icon: "🧪" },
          {
            href: "/lab-portal/requests",
            label: "Test Requests",
            labelKey: "testRequests",
            icon: "📋",
            badge: labPendingCount,
          },
          { href: "/lab-portal/upload", label: "Upload Reports", labelKey: "uploadReports", icon: "📤" },
          { href: "/lab-portal/uploads", label: "Upload History", labelKey: "uploadHistory", icon: "📊" },
          { href: "/lab-portal/forms", label: "Forms & Documents", labelKey: "formsAndDocuments", icon: "📄" },
          { href: "/lab-portal/profile", label: "Lab Profile", labelKey: "labProfile", icon: "🏢" },
        ],
      },
      {
        label: t.nav.groupResources || "Resources",
        items: [{ href: "/brand-portal/chat", label: "FUZE FAQ", labelKey: "fuzeAiFaq", icon: "💬" }],
      },
    ];
  } else {
    // ═══════════════════════════════════════════════════
    //  INTERNAL USERS — scoped to the active module
    // ═══════════════════════════════════════════════════
    // brandModuleHint lets us keep BD reps in Business Development when
    // they drill into a LEAD / PRESENTATION brand, instead of getting
    // kicked into Partners (which owns /brands by URL).
    scopedModule = findActiveModule(pathname, brandModuleHint);

    // Translate helper — keep using existing keys where available, fallback to module's English label
    function translateModuleLabel(m: ModuleDef): string {
      // Phase 13E — sales-pipeline absorbed business-development. We
      // pull the same translation key for back-compat; future i18n
      // rename to groupSalesPipeline can land independently.
      const tMap: Record<string, string | undefined> = {
        "sales-pipeline": t.nav.groupBizDev,
        operations: t.nav.groupOps,
        "quality-labs": t.nav.groupQualityLabs,
        partners: t.nav.groupPartners,
        resources: t.nav.groupResourcesDocs,
        admin: t.nav.groupAdminEmoji,
      };
      return tMap[m.key] || m.label;
    }

    // Badge lookup for dynamic counts
    function badgeFor(item: ModuleItem): number | undefined {
      if (item.badgeKey === "testRequests") return pendingCounts.testRequests;
      if (item.badgeKey === "accessRequests") return pendingCounts.accessRequests;
      return undefined;
    }

    // Turn a ModuleDef into a NavGroup, filtering admin-only pages for non-admins
    function moduleToGroup(m: ModuleDef): NavGroup {
      return {
        label: translateModuleLabel(m),
        items: m.items
          .filter((it) => !it.adminOnly || isAdmin)
          .map((it) => ({
            href: it.href,
            label: it.label,
            labelKey: it.labelKey,
            icon: it.icon || "•",
            badge: badgeFor(it),
          })),
      };
    }

    if (scopedModule && !onHome) {
      // SCOPED VIEW — only this module's items
      groups = [moduleToGroup(scopedModule)];
    } else {
      // HOME / UNSCOPED — show all 6 modules collapsed so the user can jump in
      groups = MODULES.filter((m) => !m.adminOnly || isAdmin).map(moduleToGroup);
    }
  }

  // If admin is browsing the factory portal, prepend factory-portal nav (unchanged behavior)
  if (pathname.startsWith("/factory-portal") && isAdmin && !isBrandUser && !isFactoryUser) {
    const factoryPortalGroup: NavGroup = {
      label: "Factory Portal",
      items: [
        { href: "/factory-portal", label: "Dashboard", icon: "📊" },
        { href: "/factory-portal/intake", label: "Submit Fabric", icon: "📥" },
        { href: "/factory-portal/fabrics", label: "Fabrics & Submissions", icon: "🧵" },
        { href: "/factory-portal/tests", label: "Test Results", icon: "🧪" },
        { href: "/factory-portal/upload-report", label: "Upload Test Report", icon: "📤" },
        { href: "/factory-portal/sample-trial", label: "Sample Trials", icon: "🧪" },
        { href: "/factory-portal/request-test", label: "Request Test", icon: "📋" },
        { href: "/factory-portal/orders", label: "Order FUZE", icon: "🛒" },
      ],
    };
    groups.unshift(factoryPortalGroup);
  }

  // ─── Expanded state — auto-expand group containing active route
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const newState: Record<string, boolean> = {};
    groups.forEach((g) => {
      const hasActive = g.items.some(
        (item) => pathname === item.href || pathname.startsWith(item.href + "/"),
      );
      // Scoped single-module view → always expanded
      if (groups.length === 1) newState[g.label] = true;
      else if (hasActive) newState[g.label] = true;
      else if (expandedGroups[g.label] !== undefined) newState[g.label] = expandedGroups[g.label];
      else newState[g.label] = false;
    });
    setExpandedGroups(newState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setLangOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const currentLocale = LOCALES.find((l) => l.code === locale) || LOCALES[0];
  const topActive = pathname === topItem.href;

  // Is the sidebar in scoped-module mode for an internal user?
  const inScopedModule = isInternal && !!scopedModule && !onHome;

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-slate-900 text-white flex items-center justify-between px-4 h-14 shadow-lg">
        <button
          onClick={() => setOpen(!open)}
          className="p-2 -ml-2 rounded-lg hover:bg-slate-800 transition-colors"
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {open ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
        <FuzeLogo size="sm" layout="horizontal" theme="light" />
        <div className="relative">
          <NotificationBell />
        </div>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-screen w-64 bg-slate-900 text-white flex flex-col
          transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Brand */}
        <div className="px-6 py-5 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <FuzeLogo size="md" layout="horizontal" theme="light" />
            <div className="relative">
              <NotificationBell />
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-1.5">{t.nav.subtitle}</p>
        </div>

        {/* Search */}
        <div className="px-3 pt-4 pb-2">
          <button
            onClick={() => {
              window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 bg-slate-800/50 hover:bg-slate-800 hover:text-white transition-colors border border-slate-700/50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <span>Search...</span>
            <kbd className="ml-auto text-[10px] bg-slate-700 px-1.5 py-0.5 rounded font-mono text-slate-400">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {inScopedModule ? (
            // ─── SCOPED MODULE VIEW ─────────────────────
            <>
              {/* Prominent "All Modules" return */}
              <Link
                href="/home"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-300 bg-slate-800/60 hover:bg-slate-800 hover:text-white transition-colors border border-slate-700/60"
              >
                <span className="text-base">←</span>
                <span className="flex-1">All Modules (Home)</span>
              </Link>

              {/* Module header */}
              {scopedModule && (
                <div className="mt-3 px-3 py-2 rounded-lg bg-gradient-to-br from-slate-800/80 to-slate-800/40 border border-slate-700/50">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                    Module
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-lg">{scopedModule.icon}</span>
                    <span className={`text-sm font-black ${scopedModule.sidebarAccent}`}>
                      {scopedModule.label}
                    </span>
                  </div>
                </div>
              )}

              <div className="border-t border-slate-800 my-2" />

              {/* Just this module's items — flat, no collapse */}
              {groups[0] && (
                <div className="space-y-0.5">
                  {groups[0].items.map((item) => (
                    <NavLink key={item.href} item={item} pathname={pathname} />
                  ))}
                </div>
              )}
            </>
          ) : (
            // ─── HOME / PORTAL VIEW ─────────────────────
            <>
              {/* Top link (Home or portal dashboard) */}
              <Link
                href={topItem.href}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                  ${
                    topActive
                      ? "bg-[#00b4c3] text-white shadow-lg shadow-[#00b4c3]/30"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }
                `}
              >
                <span className="text-base">{topItem.icon}</span>
                {topItem.label}
              </Link>

              <div className="border-t border-slate-800 my-2" />

              {/* For internal home view: friendly hint */}
              {isInternal && onHome && (
                <div className="px-3 pb-2 text-[11px] text-slate-500 leading-snug">
                  Pick a module from the cards on the right. The sidebar will scope itself to just
                  that module&apos;s tools. Hit &ldquo;Home&rdquo; any time to switch modules.
                </div>
              )}

              {/* Grouped nav */}
              <div className="space-y-1">
                {groups.map((group) => (
                  <NavSection
                    key={group.label}
                    group={group}
                    pathname={pathname}
                    expanded={expandedGroups[group.label] ?? false}
                    onToggle={() => toggleGroup(group.label)}
                  />
                ))}
              </div>
            </>
          )}
        </nav>

        {/* Language Switcher */}
        <div className="px-3 pb-2 relative">
          <button
            onClick={() => setLangOpen(!langOpen)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <span className="text-base">{currentLocale.flag}</span>
            <span>{currentLocale.label}</span>
            <svg
              className={`w-3 h-3 ml-auto transition-transform ${langOpen ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 15l7-7 7 7"
              />
            </svg>
          </button>
          {langOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-1 bg-slate-800 rounded-lg shadow-xl border border-slate-700 overflow-hidden max-h-72 overflow-y-auto">
              {LOCALES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => {
                    setLocale(l.code as Locale);
                    setLangOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors ${
                    l.code === locale
                      ? "bg-[#00b4c3] text-white"
                      : "text-slate-300 hover:bg-slate-700 hover:text-white"
                  }`}
                >
                  <span>{l.flag}</span>
                  <span>{l.label}</span>
                  {l.code === locale && <span className="ml-auto text-xs">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* View As switcher — render eagerly during auth-loading so it
            doesn't flicker out on every page refresh for admins.
            (Bug surfaced 2026-05-18: race condition where user was null
            mid-hydration caused the conditional to fail and re-show
            after auth fetched. Loading-state guard keeps the slot
            visible across the hydration window for both cases.) */}
        {(loading || user?.role === "ADMIN" || impersonation?.active) && (
          <div className="px-3 pb-2">
            <ViewAsSwitcher />
          </div>
        )}

        {/* User section */}
        {user && (
          <div className="px-3 pb-2">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-800/50">
              <div className="w-8 h-8 rounded-full bg-[#00b4c3] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {user.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">{user.name}</p>
                <p className="text-[10px] text-slate-400">{ROLE_LABELS[user.role] || user.role}</p>
              </div>
              <button
                onClick={logout}
                className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors flex-shrink-0"
                title="Sign out"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800">
          <p className="text-xs text-slate-500">{t.nav.company}</p>
          <p className="text-xs text-slate-600">{t.nav.version}</p>
        </div>
      </aside>
    </>
  );
}
