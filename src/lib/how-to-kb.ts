// @ts-nocheck
/**
 * FUZE Atlas How-Do-I Knowledge Base.
 *
 * Curated step-by-step answers for the most common "how do I X?" questions.
 * Entries are scored against the user's (role, currentPath, query) — so when
 * someone clicks the help button on /factory-portal/request-test, the first
 * suggestions are about requesting a test.
 *
 * To add a new entry: append to HOW_TO_ENTRIES below. Keep `steps` short and
 * action-oriented — each step is one thing the user actually does.
 */

export type HowToRole =
  | "ADMIN"
  | "EMPLOYEE"
  | "SALES_MANAGER"
  | "SALES_REP"
  | "BRAND_USER"
  | "BRAND_MANAGER"
  | "FACTORY_USER"
  | "FACTORY_MANAGER"
  | "DISTRIBUTOR_USER"
  | "LAB_USER"
  | "*"; // "*" = any role

export interface HowToEntry {
  id: string;
  title: string;
  shortAnswer: string; // 1-sentence summary shown before expanding
  steps: string[]; // ordered, each a single action
  applicableRoles: HowToRole[];
  /** Path prefixes where this entry is highly relevant — boosts ranking */
  applicablePaths: string[];
  /** Lower-case keywords for text search */
  keywords: string[];
  /** Optional deep links offered at the bottom of the answer */
  relatedLinks?: { label: string; href: string }[];
}

export const HOW_TO_ENTRIES: HowToEntry[] = [
  {
    id: "submit-fabric",
    title: "How do I submit a fabric?",
    shortAnswer:
      "Fabrics are submitted from the Factory Portal intake form — each submission gets a FUZE# you'll use everywhere after.",
    steps: [
      "Sign in as a factory user and go to Factory Portal → Submit Fabric (/factory-portal/intake).",
      "Fill out Sections 1–6: category, construction, yarn, weight, color, finish.",
      "Attach photos of the fabric face and back (clear, well-lit).",
      "Hit Submit. You'll receive a FUZE# (e.g. FUZE-1234) — keep it; every test, order, and report uses it.",
    ],
    applicableRoles: ["FACTORY_USER", "FACTORY_MANAGER", "ADMIN", "EMPLOYEE"],
    applicablePaths: ["/factory-portal/intake", "/factory-portal"],
    keywords: ["submit", "fabric", "intake", "new fabric", "register", "fuze number", "fuze#"],
    relatedLinks: [{ label: "Open submit fabric form", href: "/factory-portal/intake" }],
  },
  {
    id: "request-test",
    title: "How do I request a test for my fabric?",
    shortAnswer:
      "From the Factory Portal, pick your fabric, pick a lab (or let FUZE decide), choose tests, and follow the shipping instructions.",
    steps: [
      "Go to Factory Portal → Request Test (/factory-portal/request-test).",
      "Section 1: pick the fabric you want tested (must already be submitted).",
      "Section 2: choose a lab (US Lab, VL Shanghai, BV HK, ITS TW) — or leave as 'Let FUZE decide' if unsure.",
      "Section 3: check the tests you need (ICP, antibacterial, antifungal, odor, UV). The system picks the largest MOQ across selected tests.",
      "Section 4: review sample requirements — you'll see if a control fabric is required.",
      "Section 5: follow shipping instructions for the address shown and add tracking if you have it.",
      "Hit Submit. You'll get a FUZE-PO number and admins are notified to approve.",
    ],
    applicableRoles: ["FACTORY_USER", "FACTORY_MANAGER", "ADMIN", "EMPLOYEE"],
    applicablePaths: ["/factory-portal/request-test", "/factory-portal"],
    keywords: [
      "request test",
      "test",
      "lab",
      "po",
      "purchase order",
      "icp",
      "antibacterial",
      "submit test",
    ],
    relatedLinks: [
      { label: "Open request test form", href: "/factory-portal/request-test" },
      { label: "See my test requests", href: "/factory-portal/my-requests" },
    ],
  },
  {
    id: "see-test-results",
    title: "How do I see my test results?",
    shortAnswer:
      "Results appear in the Brand Portal or Factory Portal under 'My Requests' once the lab uploads the report.",
    steps: [
      "Open the portal that matches your role (Brand or Factory).",
      "Click 'My Requests' in the sidebar.",
      "Find the test request by PO number and click it.",
      "When the lab uploads the report, you'll see PASS/FAIL, the PDF report, and raw values.",
      "You'll also get a bell notification + email the moment results are uploaded.",
    ],
    applicableRoles: [
      "BRAND_USER",
      "BRAND_MANAGER",
      "FACTORY_USER",
      "FACTORY_MANAGER",
      "ADMIN",
      "EMPLOYEE",
    ],
    applicablePaths: ["/brand-portal", "/factory-portal/my-requests"],
    keywords: ["results", "test results", "report", "pass fail", "where", "find test"],
  },
  {
    id: "place-order",
    title: "How do I place a FUZE order?",
    shortAnswer:
      "Go to your portal's Orders page, pick the factory, enter volume in liters and/or hangtags, and submit for approval.",
    steps: [
      "Distributor Portal: Orders → New Restock. Pick the factory from the dropdown (yours, then territory, then others).",
      "Enter volume (liters) and/or hangtag quantity.",
      "Review the price — it comes from your negotiated pricing tier for that factory or country.",
      "Add PO number and shipping details.",
      "Submit. Your account manager is notified instantly. You'll see the order status progress in your bell.",
    ],
    applicableRoles: ["DISTRIBUTOR_USER", "ADMIN", "EMPLOYEE"],
    applicablePaths: ["/distributor-portal/orders", "/distributor-portal"],
    keywords: ["order", "place order", "restock", "po", "hangtag", "liters", "purchase"],
    relatedLinks: [{ label: "Open distributor orders", href: "/distributor-portal/orders" }],
  },
  {
    id: "add-company",
    title: "How do I add a new brand / factory / lab / distributor?",
    shortAnswer:
      "Use the '+ Add Company' button — it's on every company list page (Brands, Factories, Labs).",
    steps: [
      "Go to /brands, /factories, or /labs.",
      "Click the blue '+ Add Company' button at the top right.",
      "Pick the company type (Brand / Factory / Lab / Distributor) if it isn't pre-selected.",
      "Fill the form — name, country, and region are the key fields.",
      "Hit Create. You'll be taken directly to that company's detail page.",
    ],
    applicableRoles: ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"],
    applicablePaths: ["/brands", "/factories", "/labs"],
    keywords: ["add company", "new brand", "new factory", "new lab", "new distributor", "create"],
    relatedLinks: [
      { label: "Add from Brands", href: "/brands" },
      { label: "Add from Factories", href: "/factories" },
    ],
  },
  {
    id: "distributor-pricing",
    title: "How do I set distributor pricing tiers?",
    shortAnswer:
      "Each distributor has a pricing admin page where you add tiers scoped to a factory, country, region, or default.",
    steps: [
      "Open the distributor's detail page, then click 'Pricing Tiers' — or go directly to /admin/distributors/[id]/pricing.",
      "Click '+ Add Tier' and pick a scope: Factory (most specific) / Country / Region / Default (least specific).",
      "Enter price per liter, currency, minimum order, hangtag price/MOQ, and lead time.",
      "Mark one tier as Default if you want a fallback when no factory/country/region match.",
      "Save. Orders for this distributor will resolve in order: Factory → Country → Region → Default.",
    ],
    applicableRoles: ["ADMIN", "EMPLOYEE"],
    applicablePaths: ["/admin/distributors", "/distributor-portal/pricing"],
    keywords: [
      "pricing",
      "tier",
      "distributor price",
      "price per liter",
      "hangtag price",
      "markup",
    ],
  },
  {
    id: "log-email-crm",
    title: "How do I log an email to Atlas from Outlook?",
    shortAnswer:
      "Cc log@fuzeatlas.com on the email — it'll show up in the contact's timeline automatically.",
    steps: [
      "Compose your email in Outlook as normal.",
      "Add log@fuzeatlas.com to the Cc (or Bcc) line.",
      "Send. Atlas matches the recipient to a Contact and posts the email into the Brand/Factory timeline as a note.",
      "If multiple contacts match, we log to each of them.",
      "Set up an Outlook rule to auto-Cc log@fuzeatlas.com on every send if you want it hands-free (see docs/outlook-email-log-setup.md).",
    ],
    applicableRoles: ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"],
    applicablePaths: ["/brands", "/factories", "/contacts"],
    keywords: ["email", "outlook", "log email", "bcc", "cc", "crm", "notes", "timeline"],
  },
  {
    id: "approve-test-request",
    title: "How do I approve a test request (admin)?",
    shortAnswer:
      "Open /test-requests, find PENDING_APPROVAL items, review and click Approve — shipping instructions email fires automatically.",
    steps: [
      "Go to /test-requests.",
      "Filter by status 'Pending Approval' — factory submissions land here.",
      "Click a row to open it. Verify the fabric, tests, and lab selected.",
      "Click Approve. The requester gets shipping instructions by email + a bell notification.",
      "If something's wrong, click Reject with a reason — the request goes back to Draft so they can fix it.",
    ],
    applicableRoles: ["ADMIN", "EMPLOYEE"],
    applicablePaths: ["/test-requests", "/admin"],
    keywords: ["approve", "reject", "pending approval", "test request", "po approval"],
    relatedLinks: [{ label: "Open Test Requests", href: "/test-requests" }],
  },
  {
    id: "find-factory",
    title: "How do I find a factory by country?",
    shortAnswer:
      "On /factories, click any country chip in the 'top countries' bar to filter — click again to clear.",
    steps: [
      "Go to /factories.",
      "You'll see country count chips across the top (Taiwan, China, Vietnam, etc.).",
      "Click a country to filter the table.",
      "Click the same chip again to clear, or use the search box for more specific queries.",
      "For a map-style view, click 'Discovery View' at the top right.",
    ],
    applicableRoles: ["*"],
    applicablePaths: ["/factories"],
    keywords: ["factory", "find factory", "country", "discover", "search", "filter"],
  },
  {
    id: "notifications",
    title: "How do I view my notifications?",
    shortAnswer:
      "Click the bell icon in the top right of the sidebar — unread notifications have a teal dot.",
    steps: [
      "Click the bell 🔔 in the sidebar header.",
      "Unread items have a colored dot and bold title.",
      "Click one to go straight to the relevant record.",
      "Click 'Mark all as read' to clear the counter.",
      "Full history is at /notifications.",
    ],
    applicableRoles: ["*"],
    applicablePaths: ["*"],
    keywords: ["notification", "bell", "alert", "unread", "inbox"],
    relatedLinks: [{ label: "All notifications", href: "/notifications" }],
  },
  {
    id: "invite-user",
    title: "How do I invite a new user (brand / factory / lab / distributor)?",
    shortAnswer:
      "Open the company record → Team tab → Invite User. They'll get an email with a set-password link.",
    steps: [
      "Find the company (/brands, /factories, /labs, or /distributor-portal).",
      "Click its name to open the detail page.",
      "Go to the Team tab (or 'Users' section).",
      "Click 'Invite User' and enter their name, email, and role (e.g. FACTORY_USER, LAB_USER).",
      "They'll get an invitation email with a one-time link to set their password.",
    ],
    applicableRoles: ["ADMIN", "EMPLOYEE"],
    applicablePaths: ["/brands", "/factories", "/labs", "/distributor-portal"],
    keywords: ["invite", "new user", "add user", "team", "access", "permission"],
  },
  {
    id: "feedback-problem",
    title: "How do I report a bug or suggest something?",
    shortAnswer: "Click the 🐛 button at the bottom right of any page and pick 'Report a problem'.",
    steps: [
      "Click the 🐛 Something's off? button (bottom right, every page).",
      "Pick 'Report a problem'.",
      "Choose a category (Broken / Error / Confusing / Missing / Idea).",
      "Give it a one-line title and short description — paste a screenshot with ⌘V if useful.",
      "Hit Send. Andrew reviews all reports and you'll get a follow-up notification when fixed.",
    ],
    applicableRoles: ["*"],
    applicablePaths: ["*"],
    keywords: ["bug", "report", "problem", "feedback", "broken", "help", "stuck"],
  },
];

/**
 * Rank KB entries against a user's situation.
 *  - Role match: +3 (or +1 for '*')
 *  - Path match: +4 for exact prefix, +1 for any applicablePath containing the current
 *  - Keyword hit: +5 per distinct keyword in title/keywords, +2 per hit in shortAnswer
 *  - Title contains query: +10
 */
export function rankHowTo(
  query: string,
  role: string | null | undefined,
  currentPath: string | null | undefined,
): HowToEntry[] {
  const q = (query || "").toLowerCase().trim();
  const qTokens = q.length > 0 ? q.split(/\s+/).filter(Boolean) : [];
  const userRole = (role || "").toUpperCase();
  const path = (currentPath || "").toLowerCase();

  const scored = HOW_TO_ENTRIES.map((e) => {
    let score = 0;

    // Role
    if (e.applicableRoles.includes("*")) score += 1;
    if (userRole && e.applicableRoles.includes(userRole as HowToRole)) score += 3;

    // Path
    for (const p of e.applicablePaths) {
      if (p === "*") {
        score += 1;
        continue;
      }
      if (path.startsWith(p.toLowerCase())) {
        score += 4;
        break;
      }
    }

    // Query match
    if (q) {
      if (e.title.toLowerCase().includes(q)) score += 10;
      if (e.shortAnswer.toLowerCase().includes(q)) score += 3;
      const hay = [e.title.toLowerCase(), ...e.keywords.map((k) => k.toLowerCase())].join(" ");
      for (const tok of qTokens) {
        if (tok.length < 2) continue;
        if (hay.includes(tok)) score += 5;
        else if (e.shortAnswer.toLowerCase().includes(tok)) score += 2;
        else if (e.steps.some((s) => s.toLowerCase().includes(tok))) score += 1;
      }
    }

    return { entry: e, score };
  });

  const minScore = q ? 1 : 0;
  return scored
    .filter((s) => s.score > minScore)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.entry);
}
