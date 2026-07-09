// @ts-nocheck
import { NextResponse } from "next/server";
import { getRealUser } from "@/lib/auth";
import { getAdminAlerts } from "@/lib/admin-alerts";

/**
 * GET /api/admin/alerts
 *
 * Thin wrapper around getAdminAlerts() (the single source of truth,
 * also consumed by the daily-digest cron). Gate: ADMIN, EMPLOYEE,
 * SALES_MANAGER, TESTING_MANAGER — resolved via getRealUser so a
 * stale View-As cookie can't silently 403 the real admin and blank
 * the /admin banner (root cause of the "banner never renders" bug).
 */
const ALLOWED = new Set(["ADMIN", "EMPLOYEE", "SALES_MANAGER", "TESTING_MANAGER"]);

export async function GET() {
  const me = await getRealUser();
  if (!me) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!ALLOWED.has(me.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const alerts = await getAdminAlerts();
  return NextResponse.json({ ok: true, ...alerts, generatedAt: new Date().toISOString() });
}
