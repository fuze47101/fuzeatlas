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
  // Phase 16 i18n — points into t.modules[labelKey] for translation.
  // Consumers do `t.modules[labelKey] || label` so old call sites keep
  // working until they migrate.
  labelKey?: string;
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
      { label: "BD Wizard", labelKey: "bdWizard", href: "/admin/bd/wizard", icon: "🪄" },
      { label: "BD Sequences", labelKey: "bdSequences", href: "/admin/bd/sequences", icon: "🔁" },
      { label: "BD Scoreboard", labelKey: "bdScoreboard", href: "/admin/bd/scoreboard", icon: "📊" },
      { label: "BD Funnel", labelKey: "bdFunnel", href: "/admin/bd/funnel", icon: "🪜" },
      { label: "BD Calendar", labelKey: "bdCalendar", href: "/admin/bd/calendar", icon: "🗓️" },
      { label: "BD Playbooks", labelKey: "bdPlaybooks", href: "/admin/bd/playbooks", icon: "📘" },
      // Unified pipeline
      { label: "Brand Pipeline", labelKey: "brandPipeline", href: "/admin/brand-pipeline", icon: "🔥" },
      { label: "Brand Discovery", labelKey: "brandDiscovery", href: "/admin/brand-discovery", icon: "🌎" },
      { label: "Contact Hygiene", labelKey: "contactHygiene", href: "/admin/contact-hygiene", icon: "🧽" },
      // Conversion + revenue
      { label: "Conversion Tracking", labelKey: "conversionTracking", href: "/admin/conversion-tracking", icon: "🔄" },
      { label: "Pricing & Volume", labelKey: "pricingVolume", href: "/pipeline", icon: "💰" },
      { label: "Invoices", labelKey: "invoices", href: "/invoices", icon: "🧾" },
      // ACM essentials folded in
      { label: "My Tasks", labelKey: "myTasks", href: "/acm/tasks", icon: "✅" },
      { label: "Meetings", labelKey: "meetings", href: "/meetings", icon: "📅" },
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
    // Landing matches the first item in the card list (KPI Dashboard)
    // so clicking the card == clicking the top of the card listing.
    // Andrew flagged May 13: card click was landing somewhere
    // unexpected vs. what the card shows.
    landing: "/dashboard",
    items: [
      { label: "KPI Dashboard", labelKey: "kpiDashboard", href: "/dashboard", icon: "📊" },
      { label: "Submissions", labelKey: "submissions", href: "/admin/orders", icon: "📥" },
      { label: "Tests", labelKey: "tests", href: "/tests", icon: "🧫" },
      { label: "Orders Dashboard", labelKey: "ordersDashboard", href: "/admin/orders-dashboard", icon: "📦" },
      { label: "Production Batches", labelKey: "productionBatches", href: "/admin/batches", icon: "🏭" },
      { label: "Worldwide Inventory", labelKey: "worldwideInventory", href: "/admin/worldwide-inventory", icon: "🌍" },
      { label: "Consumption & Reorder", labelKey: "consumptionReorder", href: "/admin/consumption", icon: "📈" },
      { label: "Distributor Restocks", labelKey: "distributorRestocks", href: "/admin/distributor-restock", icon: "💧" },
      { label: "Sample Tracking", labelKey: "sampleTracking", href: "/shipments", icon: "📮" },
      { label: "Shipping Docs", labelKey: "shippingDocs", href: "/shipping-docs", icon: "🚢" },
      { label: "Command Center", labelKey: "commandCenter", href: "/admin/command-center", icon: "🛰️", adminOnly: true },
      { label: "Supply-chain Globe", labelKey: "supplyChainGlobe", href: "/admin/command-center/globe", icon: "🌐", adminOnly: true },
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
    // Landing matches the first item in the card list (Fabrics) so the
    // user lands at the natural start of the fabric→recipe→test
    // workflow, not in the middle of it. Andrew flagged May 13.
    landing: "/fabrics",
    items: [
      // Fabric core
      { label: "Fabrics", labelKey: "fabrics", href: "/fabrics", icon: "🧵" },
      { label: "Fabric Intake", labelKey: "fabricIntake", href: "/fabrics/intake", icon: "📥" },
      { label: "FUZE Fabric Library", labelKey: "fuzeFabricLibrary", href: "/fabric-library", icon: "📚" },
      // Recipe bench
      { label: "Recipe Library", labelKey: "recipeLibrary", href: "/recipes", icon: "📖" },
      { label: "Recipe Calculator", labelKey: "recipeCalculator", href: "/admin/recipe-calculator", icon: "🧪" },
      { label: "Recipe Bench SOP", labelKey: "recipeBenchSop", href: "/admin/recipe-calculator/sop", icon: "📋" },
      // ICP sample prep
      { label: "ICP Sample Prep", labelKey: "icpSamplePrep", href: "/admin/icp-sample-prep", icon: "⚖️" },
      { label: "ICP Prep SOP", labelKey: "icpPrepSop", href: "/admin/icp-sample-prep/sop", icon: "📋" },
      // Lab pipeline + analytics
      { label: "Test Requests", labelKey: "testRequests", href: "/test-requests", icon: "📝", badgeKey: "testRequests" },
      { label: "Ongoing Tests", labelKey: "ongoingTests", href: "/admin/ongoing-tests", icon: "🔬" },
      { label: "Sample Trials", labelKey: "sampleTrials", href: "/admin/sample-trials", icon: "🧪" },
      { label: "Test Repository", labelKey: "testRepository", href: "/admin/test-repository", icon: "🗂️", adminOnly: true },
      { label: "Inter-Lab Variance", labelKey: "interLabVariance", href: "/admin/inter-lab-variance", icon: "📊", adminOnly: true },
      { label: "Lab Review Queue", labelKey: "labReviewQueue", href: "/admin/lab-review", icon: "📋", adminOnly: true },
      { label: "Test Catalog & Pricing", labelKey: "testCatalogPricing", href: "/admin/test-catalog", icon: "💲", adminOnly: true },
      // Solaris IR (instrumentation)
      { label: "Solaris IR Test (FZ-500)", labelKey: "solarisIrTest", href: "/admin/solaris-test", icon: "☀️" },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  {
    key: "partners",
    label: "Partners",
    icon: "🤝",
    accent: "from-amber-500 to-amber-700",
    sidebarAccent: "text-amber-400",
    // Partners = active working relationships. NOT leads / BD prospecting —
    // that lives in the Sales & Pipeline module to avoid duplication.
    blurb: "Active brand partners, factories, distributors, labs",
    landing: "/brands",
    items: [
      { label: "Brand Partners", labelKey: "brandPartners", href: "/brands", icon: "👕" },
      { label: "Factories", labelKey: "factories", href: "/factories", icon: "🏭" },
      { label: "Distributors", labelKey: "distributors", href: "/admin/distributors", icon: "🌍" },
      { label: "Distributor Documents", labelKey: "distributorDocuments", href: "/admin/distributor-docs", icon: "📂" },
      { label: "Labs", labelKey: "labs", href: "/labs", icon: "🏢" },
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
      { label: "Document Library", labelKey: "documentLibrary", href: "/compliance-library", icon: "📋" },
      { label: "Product Documents (TDS/SDS/COA)", labelKey: "productDocuments", href: "/admin/product-documents", icon: "📘" },
      { label: "SOWs", labelKey: "sows", href: "/sow", icon: "📄" },
      { label: "Pricing Calculator", labelKey: "pricingCalculator", href: "/pricing", icon: "💰" },
      { label: "Application Calculator", labelKey: "applicationCalculator", href: "/pricing/calculator", icon: "🧮" },
      // Education (folded in from former Education module)
      { label: "FUZE Basics", labelKey: "fuzeBasics", href: "/education", icon: "🎓" },
      { label: "How FUZE Works", labelKey: "howFuzeWorks", href: "/education#mechanism", icon: "⚛️" },
      { label: "Certified Testing Protocol", labelKey: "certifiedTestingProtocol", href: "/education/testing-protocol", icon: "🧪" },
      { label: "Life Cycle Analysis", labelKey: "lifeCycleAnalysis", href: "/education/lifecycle", icon: "♻️" },
      { label: "Testing & Validation", labelKey: "testingValidation", href: "/education#testing", icon: "🧪" },
      { label: "Performance Stack (F1–F4)", labelKey: "performanceStack", href: "/education#performance-stack", icon: "🪜" },
      { label: "The FUZE Story", labelKey: "fuzeStory", href: "/education/story", icon: "🌍" },
      { label: "Application Methods", labelKey: "applicationMethods", href: "/education/application", icon: "🏭" },
      { label: "Sustainability Report", labelKey: "sustainabilityReport", href: "/sustainability", icon: "🌱" },
      // Press kit + compliance + competitive
      { label: "Press Kit (admin)", labelKey: "pressKit", href: "/admin/press-kit", icon: "📰", adminOnly: true },
      { label: "Public Claims", labelKey: "publicClaims", href: "/claims", icon: "📜" },
      { label: "Compliance & Certifications", labelKey: "complianceCertifications", href: "/education/compliance", icon: "✅" },
      { label: "Market Landscape", labelKey: "marketLandscape", href: "/admin/competitor-pricing", icon: "📊" },
      // Reports
      { label: "Weekly Summary", labelKey: "weeklySummary", href: "/reports", icon: "📈" },
      { label: "Weekly Exec Review", labelKey: "weeklyExecReview", href: "/admin/weekly-review", icon: "📊", adminOnly: true },
      { label: "FUZE AI FAQ", labelKey: "fuzeAiFaq", href: "/brand-portal/chat", icon: "💬" },
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
      { label: "My Profile", labelKey: "myProfile", href: "/settings/profile", icon: "👤" },
      { label: "Notifications", labelKey: "notifications", href: "/notifications", icon: "🔔" },
      { label: "User Management", labelKey: "userManagement", href: "/settings/users", icon: "👥" },
      {
        label: "Access Requests",
        labelKey: "accessRequests",
        href: "/settings/access-requests",
        icon: "📩",
        badgeKey: "accessRequests",
      },
      { label: "Availability Settings", labelKey: "availabilitySettings", href: "/settings/availability", icon: "⏰" },
      { label: "Exchange Rates", labelKey: "exchangeRates", href: "/settings/exchange-rates", icon: "💱" },
      { label: "Email Templates", labelKey: "emailTemplates", href: "/settings/email-templates", icon: "✉️" },
      { label: "Audit Log", labelKey: "auditLog", href: "/settings/audit-log", icon: "📜" },
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
