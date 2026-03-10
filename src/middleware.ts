import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fuze-atlas-dev-secret-change-in-production"
);
const COOKIE_NAME = "fuze-session";

// Routes that don't require authentication
const PUBLIC_PATHS = ["/login", "/request-access", "/request-factory-access", "/forgot-password", "/reset-password", "/api/auth/login", "/api/auth/register", "/api/auth/logout", "/api/auth/setup-check", "/api/auth/forgot-password", "/api/auth/reset-password", "/api/access-requests"];

// Routes restricted to internal roles only (ADMIN, EMPLOYEE, SALES_*, TESTING_*, FABRIC_*)
// Factory, Brand, and Distributor users CANNOT access these even with a valid session
const INTERNAL_ONLY_PATHS = [
  "/pipeline", "/revenue", "/invoices", "/brand-engagement",
  "/brands", "/factories", "/factory-search",
  "/fabrics", "/recipes",
  "/test-requests", "/tests", "/labs",
  "/sow", "/meetings", "/shipments", "/reports",
  "/settings", "/admin",
  "/api/admin", "/api/pipeline", "/api/revenue",
  "/api/settings", "/api/invoices",
];

// Roles that are considered "external" (cannot access internal pages)
const EXTERNAL_ROLES = ["FACTORY_USER", "FACTORY_MANAGER", "BRAND_USER", "BRAND_MANAGER", "DISTRIBUTOR_USER", "PUBLIC"];

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

    // Block external users from internal-only routes
    if (EXTERNAL_ROLES.includes(user.role)) {
      const isInternalRoute = INTERNAL_ONLY_PATHS.some((p) => pathname.startsWith(p));
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
        }
        return NextResponse.redirect(new URL("/login", req.url));
      }
    }

    // Add user info to headers for downstream use
    const response = NextResponse.next();
    response.headers.set("x-user-id", user.id);
    response.headers.set("x-user-role", user.role);
    return response;
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
