// @ts-nocheck
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAdminAlerts } from "@/lib/admin-alerts";

/**
 * GET /api/admin/alerts
 *
 * Thin wrapper around getAdminAlerts() (the single source of truth,
 * also consumed by the daily-digest cron). Gate: ADMIN, EMPLOYEE,
 * SALES_MANAGER, TESTING_MANAGER.
 */
const ALLOWED = new Set(["ADMIN", "EMPLOYEE", "SALES_MANAGER", "TESTING_MANAGER"]);

export async function GET() {
  const me = await getCurrentUser();
  if (!me) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!ALLOWED.has(me.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const alerts = await getAdminAlerts();
  return NextResponse.json({ ok: true, ...alerts, generatedAt: new Date().toISOString() });
}
