import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fuze-atlas-dev-secret-change-in-production"
);
const COOKIE_NAME = "fuze-session";

// Routes that don't require authentication
// NOTE: /api/cron is exempted so Vercel Cron invocations reach the route
// handler (which has its own CRON_SECRET Bearer-token auth). Without this,
// every scheduled cron returns 401 before ever running.
// /calendar/ is exempted so per-rep ICS subscription feeds (ticket #23) can be
// fetched by Outlook/Google/Apple Calendar without a session — the URL itself
// carries an HMAC-signed token. /api/inbound/ is exempted so email + iMIP
// reply webhooks (ticket #23 + #27/#32) reach the handler with their own
// X-Webhook-Secret auth.
// /report/ and /api/fabric-report/ are exempted so customers can open
// the token-protected Full Application Report from the email link
// without needing an Atlas login (the token in the URL is the
// credential). Phase 2 Penfabric work.
const PUBLIC_PATHS = ["/login", "/request-access", "/request-factory-access", "/forgot-password", "/reset-password", "/verify-email", "/api/auth/login", "/api/auth/register", "/api/auth/logout", "/api/auth/setup-check", "/api/auth/forgot-password", "/api/auth/reset-password", "/api/auth/verify-email", "/api/auth/invitation/", "/signup/invitation/", "/api/access-requests", "/api/cron", "/calendar/", "/api/inbound/", "/report/", "/api/fabric-report/", "/factory-invitation/", "/api/factory-invitations/", "/docs/", "/api/docs/public", "/api/tracking/", "/api/webhooks/", "/verified/", "/verify/sku/", "/claims", "/press", "/api/public/", "/sitemap.xml", "/robots.txt"];

// Routes restricted to internal roles only (ADMIN, EMPLOYEE, SALES_*, TESTING_*, FABRIC_*)
// Factory, Brand, and Distributor users CANNOT access these even with a valid session.
// Note that "/admin" already covers /admin/command-center/globe — but the
// command-center page was rendering for non-admin viewers (View-As) and
// throwing data-fetch errors instead of bouncing cleanly. The middleware
// gate now stops that at the door. Tina and Jett both reported May 13.
const INTERNAL_ONLY_PATHS = [
  "/pipeline", "/revenue", "/invoices", "/brand-engagement",
  "/brands", "/factories",
  "/fabrics", "/recipes",
  "/test-requests", "/tests", "/labs",
  "/sow", "/meetings", "/shipments", "/reports",
  "/settings", "/admin",
  "/api/admin", "/api/pipeline", "/api/revenue",
  "/api/settings", "/api/invoices",
];

// Exemptions: internal paths that external users CAN access
const EXTERNAL_ALLOWED_PATHS = [
  "/fabrics/intake",
  "/fabrics/",        // Allow fabric detail pages for all users (read-only)
  "/api/fabrics/",    // Allow fabric API for all users
  "/api/brand-portal/test-request",
  "/education",       // Education hub — accessible to every signed-in role
  "/education/",      // Education sub-pages (story, application, compliance, claims)
  // Recipe report + print pages live under /admin/recipe-calculator/* but the
  // API ACLs by fabric ownership (factory/brand users see only their own).
  // Without these exemptions middleware bounced KK Chan to /home when he
  // clicked the Report button on his own Penfabric fabric (May 12 2026).
  "/admin/recipe-calculator/",
  "/api/admin/recipe-bench-tests/",
];

// Roles that are considered "external" (cannot access internal pages)
const EXTERNAL_ROLES = ["FACTORY_USER", "FACTORY_MANAGER", "BRAND_USER", "BRAND_MANAGER", "DISTRIBUTOR_USER", "LAB_USER", "PUBLIC"];

// Static file patterns to skip
const STATIC_PATTERNS = [
  /^\/_next/,
  /^\/favicon/,
  /\.(ico|png|jpg|jpeg|svg|css|js|woff|woff2)$/,
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip static files
  if (STATIC_PATTERNS.some((p) => p.test(pathname))) {
    return NextResponse.next();
  }

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check for session cookie
  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    // API routes return 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { ok: false, error: "Authentication required" },
        { status: 401 }
      );
    }
    // Page routes redirect to login
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Verify token
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const user = (payload as any).user;

    if (!user || user.status !== "ACTIVE") {
      throw new Error("Invalid session");
    }

    // Redirect external users from "/", "/home", and "/dashboard" to their portal.
    // Ticket cmoi1kz7x — Tina Distributor was hitting /dashboard and seeing a
    // BRAND-style welcome page flash before the client-side redirect fired.
    // Doing this in middleware means the page never renders, no flash.
    const PORTAL_BOUNCE_PATHS = new Set(["/", "/home", "/dashboard"]);
    if (EXTERNAL_ROLES.includes(user.role) && PORTAL_BOUNCE_PATHS.has(pathname)) {
      const role = user.role;
      if (role === "FACTORY_USER" || role === "FACTORY_MANAGER") {
        return NextResponse.redirect(new URL("/factory-portal", req.url));
      } else if (role === "BRAND_USER" || role === "BRAND_MANAGER") {
        return NextResponse.redirect(new URL("/brand-portal", req.url));
      } else if (role === "DISTRIBUTOR_USER") {
        return NextResponse.redirect(new URL("/distributor-portal", req.url));
      } else if (role === "LAB_USER") {
        return NextResponse.redirect(new URL("/lab-portal", req.url));
      }
    }

    // Cross-portal bounce — external users hitting a portal that isn't
    // theirs get redirected to their own. Penny (LAB_USER) reported
    // "Lab portal - All lab accounts show as screenshot" with the URL
    // /distributor-portal/incoming-orders; she'd reached a distributor
    // page whose API rejected her, leaving a broken/empty render. UI
    // links and onboarding deep-links shouldn't be able to strand a
    // portal user on the wrong portal. Ticket cmpdngy6x0001i604x5k11rc3.
    if (EXTERNAL_ROLES.includes(user.role)) {
      const PORTAL_PATHS: Record<string, string[]> = {
        FACTORY_USER: ["/factory-portal"],
        FACTORY_MANAGER: ["/factory-portal"],
        BRAND_USER: ["/brand-portal"],
        BRAND_MANAGER: ["/brand-portal"],
        DISTRIBUTOR_USER: ["/distributor-portal"],
        LAB_USER: ["/lab-portal"],
      };
      const ALL_PORTAL_PREFIXES = ["/factory-portal", "/brand-portal", "/distributor-portal", "/lab-portal"];
      const ownPrefixes = PORTAL_PATHS[user.role] || [];
      const onSomePortal = ALL_PORTAL_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
      const onOwnPortal = ownPrefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
      if (onSomePortal && !onOwnPortal) {
        if (pathname.startsWith("/api/")) {
          return NextResponse.json(
            { ok: false, error: "Wrong portal for this role" },
            { status: 403 }
          );
        }
        return NextResponse.redirect(new URL(ownPrefixes[0] || "/login", req.url));
      }
    }

    // Block external users from internal-only routes
    if (EXTERNAL_ROLES.includes(user.role)) {
      const isExempt = EXTERNAL_ALLOWED_PATHS.some((p) => pathname.startsWith(p));
      const isInternalRoute = !isExempt && INTERNAL_ONLY_PATHS.some((p) => pathname.startsWith(p));
      if (isInternalRoute) {
        if (pathname.startsWith("/api/")) {
          return NextResponse.json(
            { ok: false, error: "Access denied" },
            { status: 403 }
          );
        }
        // Redirect external users to their portal
        const role = user.role;
        if (role === "FACTORY_USER" || role === "FACTORY_MANAGER") {
          return NextResponse.redirect(new URL("/factory-portal", req.url));
        } else if (role === "BRAND_USER" || role === "BRAND_MANAGER") {
          return NextResponse.redirect(new URL("/brand-portal", req.url));
        } else if (role === "DISTRIBUTOR_USER") {
          return NextResponse.redirect(new URL("/distributor-portal", req.url));
        } else if (role === "LAB_USER") {
          return NextResponse.redirect(new URL("/lab-portal", req.url));
        }
        return NextResponse.redirect(new URL("/login", req.url));
      }
    }

    // Forward user identity to downstream API routes via REQUEST headers.
    // BUG FIX (Apr 2026): the previous version set these on `response.headers`
    // — that's the headers the BROWSER receives, not what the route handler
    // sees on `req.headers`. As a result every API route reading
    // req.headers.get("x-user-id") got either an empty string or whatever the
    // client supplied (trust-the-client = security hole). The correct Next.js
    // App Router pattern is to clone the request headers, mutate them, and
    // pass them via NextResponse.next({ request: { headers } }).
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-user-id", user.id);
    requestHeaders.set("x-user-role", user.role);
    if (user.brandId) requestHeaders.set("x-user-brand-id", user.brandId);
    if (user.factoryId) requestHeaders.set("x-user-factory-id", user.factoryId);
    if (user.distributorId) requestHeaders.set("x-user-distributor-id", user.distributorId);
    if (user.labId) requestHeaders.set("x-user-lab-id", user.labId);
    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch {
    // Invalid token — clear cookie and redirect
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { ok: false, error: "Session expired" },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(COOKIE_NAME);
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
