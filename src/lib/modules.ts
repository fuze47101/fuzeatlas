/**
 * ═══════════════════════════════════════════════════════════════
 * SHARED MODULE DEFINITION — single source of truth
 *
 * Both the Home page (/home) and the left Sidebar render from this
 * structure. Keeping it in one place eliminates the "sidebar has one
 * set of names, home page has another" drift that was confusing.
 *
 * Mental model:
 *   • /home shows 6 big cards → one per MODULE
 *   • Clicking a card takes you to its `landing` page
 *   • The sidebar scopes itself to the ACTIVE module (the one whose
 *     items include the current pathname). A "← All Modules / Home"
 *     link is always at the top so you can bounce back out.
 *
 * If you need to add a new page, add it to `items` on the right
 * module here — do NOT hand-edit Sidebar.tsx with a new entry.
 * ═══════════════════════════════════════════════════════════════
 */

export type ModuleItem = {
  label: string;
  href: string;
  icon?: string; // emoji rendered in sidebar
  badgeKey?: "testRequests" | "accessRequests"; // dynamic counts
  adminOnly?: boolean;
  hideInCard?: boolean; // hide from home card grid but keep in sidebar
};

export type ModuleDef = {
  key: string;
  label: string;
  icon: string;
  accent: string; // gradient classes for home card
  sidebarAccent: string; // single color class for sidebar badge
  blurb: string;
  landing: string;
  adminOnly?: boolean;
  items: ModuleItem[];
};

export const MODULES: ModuleDef[] = [
  // ═══════════════════════════════════════════════════════════════
  {
    key: "business-development",
    label: "Business Development",
    icon: "🎯",
    accent: "from-rose-500 to-rose-700",
    sidebarAccent: "text-rose-400",
    blurb: "Leads, accounts, outreach, revenue",
    landing: "/admin/brand-pipeline",
    items: [
      // Wizard is the guided default entry point now (2026-04-20 overhaul).
      // Pipeline is still here for power users who want the bulk view.
      { label: "BD Wizard", href: "/admin/bd/wizard", icon: "🪄" },
      { label: "BD Sequences", href: "/admin/bd/sequences", icon: "🔁" },
      { label: "BD Scoreboard", href: "/admin/bd/scoreboard", icon: "📊" },
      { label: "Contact Hygiene", href: "/admin/contact-hygiene", icon: "🧽" },
      { label: "Brand Pipeline (Leads)", href: "/admin/brand-pipeline", icon: "🔥" },
      { label: "Accounts", href: "/admin/accounts", icon: "⭐" },
      { label: "Brand Intelligence", href: "/admin/brand-discovery", icon: "🌎" },
      { label: "Sample → Production", href: "/admin/conversion-tracking", icon: "🔄" },
      { label: "Deals & Revenue", href: "/pipeline", icon: "💰" },
      { label: "Invoices", href: "/invoices", icon: "🧾" },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // ACM — Atlas Customer Management. This is the CRM rebrand, and it's
  // the post-BD relationship surface: accounts we already sourced, tasks
  // owed to them, contacts we've engaged, meetings on the books. Sits
  // right after Business Development intentionally — BD sources, ACM
  // holds. Bright blue-cyan gradient so it reads as a primary module,
  // not an afterthought.
  {
    key: "acm",
    label: "ACM",
    icon: "🤝",
    accent: "from-sky-500 to-cyan-600",
    sidebarAccent: "text-sky-400",
    blurb: "Atlas Customer Management — tasks, contacts, meetings",
    landing: "/acm/tasks",
    items: [
      { label: "My Tasks", href: "/acm/tasks", icon: "🗓️" },
      { label: "Accounts", href: "/admin/accounts", icon: "⭐" },
      { label: "Meetings", href: "/meetings", icon: "📅" },
      { label: "Brand Directory", href: "/brands", icon: "👕" },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  {
    key: "operations",
    label: "Operations",
    icon: "📦",
    accent: "from-[#00b4c3] to-[#009ba8]",
    sidebarAccent: "text-[#00b4c3]",
    blurb: "Orders, inventory, shipments, consumption",
    landing: "/admin/orders-dashboard",
    items: [
      { label: "KPI Dashboard", href: "/dashboard", icon: "📊" },
      { label: "Orders Dashboard", href: "/admin/orders-dashboard", icon: "📦" },
      { label: "Order Management", href: "/admin/orders", icon: "🛒" },
      { label: "Production Batches", href: "/admin/batches", icon: "🏭" },
      { label: "Distributor Pricing & Restocks", href: "/admin/distributor-restock", icon: "💧" },
      { label: "Worldwide Inventory", href: "/admin/worldwide-inventory", icon: "🌍" },
      { label: "Consumption & Reorder", href: "/admin/consumption", icon: "📈" },
      { label: "Sample Tracking", href: "/shipments", icon: "📮" },
      { label: "Shipping Docs", href: "/shipping-docs", icon: "🚢" },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  {
    key: "quality-labs",
    label: "Quality & Labs",
    icon: "🧪",
    accent: "from-violet-500 to-violet-700",
    sidebarAccent: "text-violet-400",
    blurb: "Fabrics, recipes, ICP sample prep, testing",
    landing: "/tests",
    items: [
      // Fabric core
      { label: "Fabrics", href: "/fabrics", icon: "🧵" },
      { label: "Fabric Intake", href: "/fabrics/intake", icon: "📥" },
      { label: "FUZE Fabric Library", href: "/fabric-library", icon: "📚" },
      // Bench
      { label: "Recipe Library", href: "/recipes", icon: "📖" },
      { label: "Recipe Calculator", href: "/admin/recipe-calculator", icon: "🧪" },
      { label: "Recipe Bench SOP", href: "/admin/recipe-calculator/sop", icon: "📋" },
      // NEW — ICP sample prep
      { label: "ICP Sample Prep", href: "/admin/icp-sample-prep", icon: "⚖️" },
      { label: "ICP Prep SOP (How-To)", href: "/admin/icp-sample-prep/sop", icon: "📋" },
      // Instrumentation
      { label: "Solaris IR Test (FZ-500)", href: "/admin/solaris-test", icon: "☀️" },
      // Test flow
      { label: "Test Requests", href: "/test-requests", icon: "📝", badgeKey: "testRequests" },
      { label: "Test Results", href: "/tests", icon: "🧫" },
      { label: "Ongoing Tests", href: "/admin/ongoing-tests", icon: "🔬" },
      { label: "Sample Trials", href: "/admin/sample-trials", icon: "🧪" },
      { label: "Lab Directory", href: "/labs", icon: "🏢" },
      { label: "Test Catalog & Pricing", href: "/admin/test-catalog", icon: "💲", adminOnly: true },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  {
    key: "partners",
    label: "Partners",
    icon: "🤝",
    accent: "from-amber-500 to-amber-700",
    sidebarAccent: "text-amber-400",
    blurb: "Brands, factories, distributors",
    landing: "/brands",
    items: [
      { label: "Brands", href: "/brands", icon: "👕" },
      { label: "Factories", href: "/factories", icon: "🏭" },
      { label: "Distributor Network", href: "/admin/distributors", icon: "🌍" },
      { label: "Distributor Documents", href: "/admin/distributor-docs", icon: "📂" },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  {
    key: "resources",
    label: "Resources & Docs",
    icon: "📚",
    accent: "from-emerald-500 to-emerald-700",
    sidebarAccent: "text-emerald-400",
    blurb: "Document library, SDS/TDS/COA, SOWs, pricing",
    landing: "/compliance-library",
    items: [
      { label: "Product Documents (TDS/SDS/COA)", href: "/admin/product-documents", icon: "📘" },
      { label: "Document Center", href: "/compliance-library", icon: "📋" },
      { label: "SOWs", href: "/sow", icon: "📄" },
      { label: "Meetings", href: "/meetings", icon: "📅" },
      { label: "Weekly Summary", href: "/reports", icon: "📈" },
      { label: "Weekly Exec Review", href: "/admin/weekly-review", icon: "📊", adminOnly: true },
      { label: "Market Landscape", href: "/admin/competitor-pricing", icon: "📊" },
      { label: "Pricing & Environment", href: "/pricing", icon: "💰" },
      { label: "Application Calculator", href: "/pricing/calculator", icon: "🧮" },
      { label: "Sustainability", href: "/sustainability", icon: "🌱" },
      { label: "FUZE FAQ", href: "/brand-portal/chat", icon: "💬" },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  {
    key: "admin",
    label: "Admin",
    icon: "⚙️",
    accent: "from-slate-700 to-slate-900",
    sidebarAccent: "text-slate-300",
    blurb: "Users, settings, audit log, access",
    landing: "/settings/users",
    adminOnly: true,
    items: [
      // My Profile is open to everyone (sidebar guards adminOnly per-item),
      // but it lives here so admins discover it next to user management.
      { label: "My Profile", href: "/settings/profile", icon: "👤" },
      { label: "Notifications", href: "/notifications", icon: "🔔" },
      { label: "User Management", href: "/settings/users", icon: "👥" },
      {
        label: "Access Requests",
        href: "/settings/access-requests",
        icon: "📩",
        badgeKey: "accessRequests",
      },
      { label: "Availability Settings", href: "/settings/availability", icon: "⏰" },
      { label: "Exchange Rates", href: "/settings/exchange-rates", icon: "💱" },
      { label: "Audit Log", href: "/settings/audit-log", icon: "📜" },
    ],
  },
];

/**
 * Given the current pathname, find the module that owns it. Used by
 * the sidebar to scope the nav. Returns undefined if the path doesn't
 * belong to any module (e.g. /home, /login).
 *
 * `hint` lets a calling page override the default prefix-match. Currently
 * used by the sidebar on `/brands/[id]` routes: if the brand is a LEAD or
 * PRESENTATION stage it's still a prospect, so the sidebar should stay in
 * Business Development rather than flipping to Partners. Without a hint,
 * behavior is pure longest-prefix-wins on MODULES.
 */
export type ModuleHint = "business-development" | "partners" | null | undefined;

export function findActiveModule(pathname: string, hint?: ModuleHint): ModuleDef | undefined {
  // Explicit hint wins — lets pages declare "I belong to BD" even when the
  // URL prefix (like /brands) is owned by a different module.
  if (hint) {
    const hinted = MODULES.find((m) => m.key === hint);
    if (hinted) return hinted;
  }

  // Most specific match wins (longest prefix)
  let best: { m: ModuleDef; score: number } | undefined;
  for (const m of MODULES) {
    for (const item of m.items) {
      if (pathname === item.href || pathname.startsWith(item.href + "/")) {
        const score = item.href.length;
        if (!best || score > best.score) best = { m, score };
      }
    }
    if (pathname === m.landing) {
      const score = m.landing.length;
      if (!best || score > best.score) best = { m, score };
    }
  }
  return best?.m;
}
