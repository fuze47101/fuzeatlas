/**
 * ═══════════════════════════════════════════════════════════════
 * SHARED MODULE DEFINITION — single source of truth (Phase 13E consolidation)
 *
 * Both the Home page (/home) and the left Sidebar render from this
 * structure.
 *
 * Phase 13E rewrite (May 2026): collapsed the prior 7-module sprawl
 * (BD, ACM, Operations, Quality & Labs, Partners, Education,
 * Resources, Admin) into 6 deduplicated groups per Andrew's spec.
 * Routes themselves are unchanged — only the sidebar grouping +
 * deduped naming.
 *
 *   Sales & Pipeline
 *   Operations
 *   Quality & Labs
 *   Partners
 *   Resources
 *   Admin
 *
 * Education + ACM items folded into Resources / Sales & Pipeline.
 * "Submissions" appears once (Operations). "Tests" is one entry
 * (Quality & Labs). "Brand Pipeline" is one entry (Sales & Pipeline)
 * — not duplicated across BD and Partners.
 * ═══════════════════════════════════════════════════════════════
 */

export type ModuleItem = {
  label: string;
  href: string;
  icon?: string;
  badgeKey?: "testRequests" | "accessRequests";
  adminOnly?: boolean;
  hideInCard?: boolean;
};

export type ModuleDef = {
  key: string;
  label: string;
  icon: string;
  accent: string;
  sidebarAccent: string;
  blurb: string;
  landing: string;
  adminOnly?: boolean;
  items: ModuleItem[];
};

export const MODULES: ModuleDef[] = [
  // ─────────────────────────────────────────────────────────────
  {
    key: "sales-pipeline",
    label: "Sales & Pipeline",
    icon: "📈",
    accent: "from-blue-500 to-blue-700",
    sidebarAccent: "text-blue-400",
    blurb: "BD wizard, sequences, brand pipeline, conversion, pricing",
    landing: "/admin/brand-pipeline",
    items: [
      // BD execution surfaces
      { label: "BD Wizard", href: "/admin/bd/wizard", icon: "🪄" },
      { label: "BD Sequences", href: "/admin/bd/sequences", icon: "🔁" },
      { label: "BD Scoreboard", href: "/admin/bd/scoreboard", icon: "📊" },
      { label: "BD Funnel", href: "/admin/bd/funnel", icon: "🪜" },
      { label: "BD Calendar", href: "/admin/bd/calendar", icon: "🗓️" },
      { label: "BD Playbooks", href: "/admin/bd/playbooks", icon: "📘" },
      // Unified pipeline
      { label: "Brand Pipeline", href: "/admin/brand-pipeline", icon: "🔥" },
      { label: "Brand Discovery", href: "/admin/brand-discovery", icon: "🌎" },
      { label: "Contact Hygiene", href: "/admin/contact-hygiene", icon: "🧽" },
      // Conversion + revenue
      { label: "Conversion Tracking", href: "/admin/conversion-tracking", icon: "🔄" },
      { label: "Pricing & Volume", href: "/pipeline", icon: "💰" },
      { label: "Invoices", href: "/invoices", icon: "🧾" },
      // ACM essentials folded in
      { label: "My Tasks", href: "/acm/tasks", icon: "✅" },
      { label: "Meetings", href: "/meetings", icon: "📅" },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  {
    key: "operations",
    label: "Operations",
    icon: "⚙️",
    accent: "from-orange-500 to-orange-700",
    sidebarAccent: "text-orange-400",
    blurb: "Submissions, tests, orders, batches, inventory",
    landing: "/admin/orders-dashboard",
    items: [
      { label: "KPI Dashboard", href: "/dashboard", icon: "📊" },
      { label: "Submissions", href: "/admin/orders", icon: "📥" },
      { label: "Tests", href: "/tests", icon: "🧫" },
      { label: "Orders Dashboard", href: "/admin/orders-dashboard", icon: "📦" },
      { label: "Production Batches", href: "/admin/batches", icon: "🏭" },
      { label: "Worldwide Inventory", href: "/admin/worldwide-inventory", icon: "🌍" },
      { label: "Consumption & Reorder", href: "/admin/consumption", icon: "📈" },
      { label: "Distributor Restocks", href: "/admin/distributor-restock", icon: "💧" },
      { label: "Sample Tracking", href: "/shipments", icon: "📮" },
      { label: "Shipping Docs", href: "/shipping-docs", icon: "🚢" },
      { label: "Command Center", href: "/admin/command-center", icon: "🛰️", adminOnly: true },
      { label: "Supply-chain Globe", href: "/admin/command-center/globe", icon: "🌐", adminOnly: true },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  {
    key: "quality-labs",
    label: "Quality & Labs",
    icon: "🧪",
    accent: "from-violet-500 to-violet-700",
    sidebarAccent: "text-violet-400",
    blurb: "Lab pipeline, ICP sample prep, recipes, test catalog, variance",
    landing: "/tests",
    items: [
      // Fabric core
      { label: "Fabrics", href: "/fabrics", icon: "🧵" },
      { label: "Fabric Intake", href: "/fabrics/intake", icon: "📥" },
      { label: "FUZE Fabric Library", href: "/fabric-library", icon: "📚" },
      // Recipe bench
      { label: "Recipe Library", href: "/recipes", icon: "📖" },
      { label: "Recipe Calculator", href: "/admin/recipe-calculator", icon: "🧪" },
      { label: "Recipe Bench SOP", href: "/admin/recipe-calculator/sop", icon: "📋" },
      // ICP sample prep
      { label: "ICP Sample Prep", href: "/admin/icp-sample-prep", icon: "⚖️" },
      { label: "ICP Prep SOP", href: "/admin/icp-sample-prep/sop", icon: "📋" },
      // Lab pipeline + analytics
      { label: "Test Requests", href: "/test-requests", icon: "📝", badgeKey: "testRequests" },
      { label: "Ongoing Tests", href: "/admin/ongoing-tests", icon: "🔬" },
      { label: "Sample Trials", href: "/admin/sample-trials", icon: "🧪" },
      { label: "Test Repository", href: "/admin/test-repository", icon: "🗂️", adminOnly: true },
      { label: "Inter-Lab Variance", href: "/admin/inter-lab-variance", icon: "📊", adminOnly: true },
      { label: "Lab Review Queue", href: "/admin/lab-review", icon: "📋", adminOnly: true },
      { label: "Test Catalog & Pricing", href: "/admin/test-catalog", icon: "💲", adminOnly: true },
      // Solaris IR (instrumentation)
      { label: "Solaris IR Test (FZ-500)", href: "/admin/solaris-test", icon: "☀️" },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  {
    key: "partners",
    label: "Partners",
    icon: "🤝",
    accent: "from-amber-500 to-amber-700",
    sidebarAccent: "text-amber-400",
    blurb: "Brands, factories, distributors, labs",
    landing: "/brands",
    items: [
      { label: "Brands", href: "/brands", icon: "👕" },
      { label: "Factories", href: "/factories", icon: "🏭" },
      { label: "Distributors", href: "/admin/distributors", icon: "🌍" },
      { label: "Distributor Documents", href: "/admin/distributor-docs", icon: "📂" },
      { label: "Labs", href: "/labs", icon: "🏢" },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  {
    key: "resources",
    label: "Resources",
    icon: "📚",
    accent: "from-emerald-500 to-emerald-700",
    sidebarAccent: "text-emerald-400",
    blurb: "Document library, education, press kit, compliance",
    landing: "/compliance-library",
    items: [
      // Document library
      { label: "Document Library", href: "/compliance-library", icon: "📋" },
      { label: "Product Documents (TDS/SDS/COA)", href: "/admin/product-documents", icon: "📘" },
      { label: "SOWs", href: "/sow", icon: "📄" },
      { label: "Application Calculator", href: "/pricing/calculator", icon: "🧮" },
      // Education (folded in from former Education module)
      { label: "FUZE Basics", href: "/education", icon: "🎓" },
      { label: "How FUZE Works", href: "/education#mechanism", icon: "⚛️" },
      { label: "Testing & Validation", href: "/education#testing", icon: "🧪" },
      { label: "Performance Stack (F1–F4)", href: "/education#performance-stack", icon: "🪜" },
      { label: "The FUZE Story", href: "/education/story", icon: "🌍" },
      { label: "Application Methods", href: "/education/application", icon: "🏭" },
      { label: "Sustainability Report", href: "/sustainability", icon: "🌱" },
      // Press kit + compliance + competitive
      { label: "Press Kit (admin)", href: "/admin/press-kit", icon: "📰", adminOnly: true },
      { label: "Public Claims", href: "/claims", icon: "📜" },
      { label: "Compliance & Certifications", href: "/education/compliance", icon: "✅" },
      { label: "Market Landscape", href: "/admin/competitor-pricing", icon: "📊" },
      // Reports
      { label: "Weekly Summary", href: "/reports", icon: "📈" },
      { label: "Weekly Exec Review", href: "/admin/weekly-review", icon: "📊", adminOnly: true },
      { label: "FUZE AI FAQ", href: "/brand-portal/chat", icon: "💬" },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  {
    key: "admin",
    label: "Admin",
    icon: "🔐",
    accent: "from-slate-700 to-slate-900",
    sidebarAccent: "text-slate-300",
    blurb: "User management, access requests, settings, audit log",
    landing: "/settings/users",
    adminOnly: true,
    items: [
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
      { label: "Email Templates", href: "/settings/email-templates", icon: "✉️" },
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
 * Sales & Pipeline rather than flipping to Partners. Without a hint,
 * behavior is pure longest-prefix-wins on MODULES.
 */
export type ModuleHint = "sales-pipeline" | "partners" | "business-development" | null | undefined;

export function findActiveModule(pathname: string, hint?: ModuleHint): ModuleDef | undefined {
  // Translate legacy hint values to the new keys.
  const normalizedHint =
    hint === "business-development" ? "sales-pipeline" : hint;

  if (normalizedHint) {
    const hinted = MODULES.find((m) => m.key === normalizedHint);
    if (hinted) return hinted;
  }

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
