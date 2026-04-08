// @ts-nocheck
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

/* ── Config ──────────────────────────────────────────── */
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fuze-atlas-dev-secret-change-in-production"
);
const COOKIE_NAME = "fuze-session";
const TOKEN_EXPIRY = "7d"; // 7 days

/* ── Types ───────────────────────────────────────────── */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  brandId?: string | null;
  factoryId?: string | null;
  distributorId?: string | null;
  labId?: string | null;
}

/* ── JWT helpers ─────────────────────────────────────── */
export async function createToken(user: SessionUser): Promise<string> {
  return new SignJWT({ user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return (payload as any).user as SessionUser;
  } catch {
    return null;
  }
}

/* ── Cookie helpers ──────────────────────────────────── */
export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: "/",
  });
}

export async function getSessionCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value || null;
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/* ── Get current user from cookie ────────────────────── */
const IMPERSONATE_COOKIE = "fuze-impersonate";

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = await getSessionCookie();
  if (!token) return null;
  const realUser = await verifyToken(token);
  if (!realUser) return null;

  // Check for impersonation — only ADMIN can impersonate
  if (realUser.role === "ADMIN") {
    try {
      const cookieStore = await cookies();
      const impersonateId = cookieStore.get(IMPERSONATE_COOKIE)?.value;
      if (impersonateId) {
        // Dynamic import to avoid circular dependency
        const { prisma } = await import("@/lib/prisma");
        const target = await prisma.user.findUnique({
          where: { id: impersonateId },
          select: {
            id: true, name: true, email: true, role: true, status: true,
            brandId: true, factoryId: true, distributorId: true, labId: true,
          },
        });
        if (target) {
          return {
            id: target.id,
            name: target.name,
            email: target.email,
            role: target.role,
            status: target.status,
            brandId: target.brandId,
            factoryId: target.factoryId,
            distributorId: target.distributorId,
            labId: target.labId,
          };
        }
      }
    } catch {
      // If impersonation lookup fails, fall through to real user
    }
  }

  return realUser;
}

/** Get the REAL logged-in user, ignoring impersonation. Use for audit logs and permission gates. */
export async function getRealUser(): Promise<SessionUser | null> {
  const token = await getSessionCookie();
  if (!token) return null;
  return verifyToken(token);
}

/* ── Password hashing ────────────────────────────────── */
export async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import("bcryptjs");
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  const bcrypt = await import("bcryptjs");
  return bcrypt.compare(password, hash);
}

/* ── Role hierarchy ──────────────────────────────────── */
// Higher number = more access
const ROLE_LEVEL: Record<string, number> = {
  ADMIN: 100,
  EMPLOYEE: 80,
  SALES_MANAGER: 70,
  FABRIC_MANAGER: 70,
  TESTING_MANAGER: 70,
  FACTORY_MANAGER: 70,
  SALES_REP: 50,
  LAB_USER: 30,
  FACTORY_USER: 30,
  BRAND_USER: 30,
  DISTRIBUTOR_USER: 30,
  PUBLIC: 0,
};

export function getRoleLevel(role: string): number {
  return ROLE_LEVEL[role] ?? 0;
}

export function hasMinRole(userRole: string, requiredRole: string): boolean {
  return getRoleLevel(userRole) >= getRoleLevel(requiredRole);
}

/* ── Permission checks ───────────────────────────────── */
export function canAccessBrand(user: SessionUser, brandId: string): boolean {
  // ADMIN / EMPLOYEE / managers can access all
  if (getRoleLevel(user.role) >= 70) return true;
  // SALES_REP can access assigned brands (checked at API level)
  if (user.role === "SALES_REP") return true; // further filtered at query level
  // BRAND_USER can only access their own brand
  if (user.role === "BRAND_USER") return user.brandId === brandId;
  return false;
}

export function canAccessFactory(
  user: SessionUser,
  factoryId: string
): boolean {
  if (getRoleLevel(user.role) >= 70) return true;
  if (user.role === "SALES_REP") return true;
  if (user.role === "FACTORY_USER" || user.role === "FACTORY_MANAGER")
    return user.factoryId === factoryId;
  return false;
}

/* ── Public route check (for middleware) ─────────────── */
export const PUBLIC_ROUTES = ["/login", "/api/auth/login", "/api/auth/register"];
export const COOKIE_NAME_EXPORT = COOKIE_NAME;
