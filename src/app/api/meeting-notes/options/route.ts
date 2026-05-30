// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/meeting-notes/options
 *
 * Picker payload for the structured meeting-notes UI:
 *   - all active internal users (for owner + task assignee dropdowns)
 *   - all brands (id + name)
 *   - all factories (id + name)
 *
 * Internal-only.
 */
const INTERNAL_ROLES = new Set([
  "ADMIN",
  "EMPLOYEE",
  "SALES_MANAGER",
  "SALES_REP",
  "BD_REP",
  "TESTING_MANAGER",
  "FABRIC_MANAGER",
  "FACTORY_MANAGER",
]);

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!INTERNAL_ROLES.has(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const [users, brands, factories] = await Promise.all([
    prisma.user.findMany({
      where: { status: "ACTIVE", role: { in: Array.from(INTERNAL_ROLES) } },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    (prisma as any).brand.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    (prisma as any).factory.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return NextResponse.json({ ok: true, users, brands, factories });
}
