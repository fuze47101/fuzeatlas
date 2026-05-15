// @ts-nocheck
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { loadCorrelationPoints, fitRegression } from "@/lib/icp-correlation";

/**
 * GET /api/analytics/icp-correlation
 *
 * MB-1 — returns the ICP × AB scatter dataset.
 *   - ADMIN / EMPLOYEE / TESTING_MANAGER → all brand-visible runs
 *   - BRAND_USER / BRAND_MANAGER → scoped to caller's brandId
 *   - All other roles → 403
 *
 * Response: { ok, points: [...], regression: { slope, intercept, r2, ... } | null }
 */

const ADMIN_ROLES = new Set(["ADMIN", "EMPLOYEE", "TESTING_MANAGER", "SALES_MANAGER"]);
const BRAND_ROLES = new Set(["BRAND_USER", "BRAND_MANAGER"]);

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let scopedBrandId: string | null = null;
  if (BRAND_ROLES.has(user.role)) {
    if (!user.brandId) {
      return NextResponse.json(
        { ok: false, error: "No brand associated with this user" },
        { status: 403 },
      );
    }
    scopedBrandId = user.brandId;
  } else if (!ADMIN_ROLES.has(user.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const points = await loadCorrelationPoints(scopedBrandId);
    const regression = fitRegression(points);
    return NextResponse.json({
      ok: true,
      scope: scopedBrandId ? "brand" : "all",
      brandId: scopedBrandId,
      pointCount: points.length,
      points,
      regression,
    });
  } catch (e: any) {
    console.error("[icp-correlation] failed:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to load correlation data" },
      { status: 500 },
    );
  }
}
