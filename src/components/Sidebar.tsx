"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import FuzeLogo from "./FuzeLogo";
import { useI18n, LOCALES } from "@/i18n";
import type { Locale } from "@/i18n";
import { useAuth } from "@/lib/AuthContext";

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
  PUBLIC: "Public",
};

interface NavItem {
  href: string;
  label: string;
  icon: string;
  badge?: number;
}

interface NavGroup {
  label: string;
  items: NavItem[];
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
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  );
  const groupBadgeTotal = group.items.reduce((sum, item) => sum + (item.badge || 0), 0);

  return (
    <div>
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
          hasActive
            ? "text-[#00b4c3]"
            : "text-slate-500 hover:text-slate-300"
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
          {group.items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all
                  ${active
                    ? "bg-[#00b4c3] text-white shadow-lg shadow-[#00b4c3]/30"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }
                `}
              >
                <span className="text-base">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.badge && item.badge > 0 ? (
                  <span className={`min-w-[20px] h-5 flex items-center justify-center rounded-full text-[10px] font-bold px-1.5 ${
                    active ? "bg-white/25 text-white" : "bg-red-500 text-white animate-pulse"
                  }`}>
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
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
  const { user, logout } = useAuth();

  const isBrandUser = user?.role === "BRAND_USER";
  const isFactoryUser = user?.role === "FACTORY_USER" || user?.role === "FACTORY_MANAGER";
  const isInternal = !isBrandUser && user?.role !== "FACTORY_USER" && user?.role !== "FACTORY_MANAGER" && user?.role !== "DISTRIBUTOR_USER" && user?.role !== "PUBLIC";
  const isAdmin = user?.role === "ADMIN" || user?.role === "EMPLOYEE";

  // ─── Pending counts for admin badges ─────────────────
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
    // Poll every 30 seconds for live updates
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  // ─── Grouped navigation ─────────────────────────
  // Top-level item (always visible, not in a group)
  const topItem: NavItem = { href: "/dashboard", label: t.nav.dashboard, icon: "📊" };

  // Build groups based on role
  let groups: NavGroup[] = [];

  if (isBrandUser) {
    groups = [
      {
        label: "My Program",
        items: [
          { href: "/brand-portal/fabrics", label: "My Fabrics", icon: "🧵" },
          { href: "/brand-portal/submissions", label: "Submissions", icon: "📋" },
          { href: "/brand-portal/tests", label: "Test Results", icon: "🧪" },
          { href: "/brand-portal/contacts", label: "Contacts", icon: "👥" },
        ],
      },
      {
        label: "Resources",
        items: [
          { href: "/book-meeting", label: "Book Meeting", icon: "📅" },
          { href: "/brand-portal/chat", label: "FUZE FAQ", icon: "💬" },
          { href: "/factory-search", label: "Factory Search", icon: "🔍" },
          { href: "/pricing", label: "Pricing & Environment", icon: "💰" },
          { href: "/sustainability", label: "Sustainability", icon: "🌍" },
        ],
      },
    ];
  } else if (isFactoryUser) {
    groups = [
      {
        label: "Factory Portal",
        items: [
          { href: "/factory-portal", label: "Dashboard", icon: "📊" },
          { href: "/factory-portal/intake", label: "Submit Fabric", icon: "📥" },
          { href: "/factory-portal/fabrics", label: "My Fabrics", icon: "🧵" },
          { href: "/factory-portal/submissions", label: "Submissions", icon: "📋" },
          { href: "/factory-portal/tests", label: "Test Results", icon: "🧪" },
          { href: "/factory-portal/request-test", label: "Request Test", icon: "📋" },
        ],
      },
      {
        label: "Resources",
        items: [
          { href: "/pricing", label: "Pricing", icon: "💰" },
          { href: "/brand-portal/chat", label: "FUZE FAQ", icon: "💬" },
        ],
      },
    ];
  } else {
    groups = [
      {
        label: "Sales & Pipeline",
        items: [
          { href: "/brands", label: "Brands", icon: "🔥" },
          ...(isInternal
            ? [
                { href: "/pipeline", label: "Project Flow", icon: "📊" },
                { href: "/revenue", label: "Revenue Forecast", icon: "💰" },
                { href: "/invoices", label: "Invoices", icon: "🧾" },
                { href: "/brand-engagement", label: "Brand Health", icon: "❤️" },
              ]
            : []),
        ],
      },
      {
        label: "Products & Testing",
        items: [
          { href: "/fabrics", label: t.nav.fabrics, icon: "🧵" },
          { href: "/fabrics/intake", label: "Fabric Intake", icon: "📥" },
          { href: "/recipes", label: "Recipe Library", icon: "📖" },
          { href: "/factories", label: t.nav.factories, icon: "🏭" },
          { href: "/factory-search", label: "Factory Search", icon: "🔍" },
          { href: "/test-requests", label: "Test Requests", icon: "📝", badge: pendingCounts.testRequests },
          { href: "/tests", label: t.nav.testResults, icon: "🧪" },
          { href: "/labs", label: t.nav.labDirectory || "Lab Directory", icon: "🔬" },
        ],
      },
      {
        label: "Operations",
        items: [
          { href: "/sow", label: t.nav.sowGovernance, icon: "📋" },
          { href: "/meetings", label: "Meetings", icon: "📅" },
          { href: "/shipments", label: "Sample Tracking", icon: "📦" },
          { href: "/reports", label: t.nav.weeklySummary || "Weekly Summary", icon: "📈" },
        ],
      },
      {
        label: "Tools",
        items: [
          { href: "/brand-portal/chat", label: "FUZE FAQ", icon: "💬" },
          { href: "/admin/competitor-pricing", label: "Market Landscape", icon: "📊" },
          { href: "/pricing", label: "Pricing & Environment", icon: "💰" },
          { href: "/sustainability", label: "Sustainability", icon: "🌍" },
        ],
      },
    ];

    // Admin group
    if (isAdmin) {
      groups.push({
        label: "Admin",
        items: [
          { href: "/settings/users", label: "User Management", icon: "👥" },
          { href: "/settings/availability", label: "Availability Settings", icon: "⏰" },
          { href: "/settings/access-requests", label: "Access Requests", icon: "📩", badge: pendingCounts.accessRequests },
          { href: "/settings/exchange-rates", label: "Exchange Rates", icon: "💱" },
          { href: "/settings/audit-log", label: "Audit Log", icon: "📜" },
        ],
      });
    }
  }

  // ─── Expanded state: auto-expand group containing active page ─────
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Initialize expanded state — expand group with active route, collapse others
  useEffect(() => {
    const newState: Record<string, boolean> = {};
    groups.forEach((g) => {
      const hasActive = g.items.some(
        (item) => pathname === item.href || pathname.startsWith(item.href + "/")
      );
      // If group has active item, always expand. Otherwise keep current state or default collapsed.
      if (hasActive) {
        newState[g.label] = true;
      } else if (expandedGroups[g.label] !== undefined) {
        newState[g.label] = expandedGroups[g.label];
      } else {
        newState[g.label] = false;
      }
    });
    setExpandedGroups(newState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); setLangOpen(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const currentLocale = LOCALES.find(l => l.code === locale) || LOCALES[0];

  const topActive = pathname === topItem.href;

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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
        <FuzeLogo size="sm" layout="horizontal" theme="light" />
        <div className="w-10" />
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
          <FuzeLogo size="md" layout="horizontal" theme="light" />
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span>Search...</span>
            <kbd className="ml-auto text-[10px] bg-slate-700 px-1.5 py-0.5 rounded font-mono text-slate-400">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {/* Dashboard — always visible at top */}
          <Link
            href={topItem.href}
            className={`
              flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
              ${topActive
                ? "bg-[#00b4c3] text-white shadow-lg shadow-[#00b4c3]/30"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }
            `}
          >
            <span className="text-base">{topItem.icon}</span>
            {topItem.label}
          </Link>

          {/* Divider */}
          <div className="border-t border-slate-800 my-2" />

          {/* Grouped nav sections */}
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
        </nav>

        {/* Language Switcher */}
        <div className="px-3 pb-2 relative">
          <button
            onClick={() => setLangOpen(!langOpen)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <span className="text-base">{currentLocale.flag}</span>
            <span>{currentLocale.label}</span>
            <svg className={`w-3 h-3 ml-auto transition-transform ${langOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          {langOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-1 bg-slate-800 rounded-lg shadow-xl border border-slate-700 overflow-hidden">
              {LOCALES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => { setLocale(l.code as Locale); setLangOpen(false); }}
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
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
