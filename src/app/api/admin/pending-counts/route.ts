// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { countSuspectPairs } from "@/lib/suspect-email-typos";

/* ── GET /api/admin/pending-counts ── Returns pending counts for admin badges ── */
export async function GET(req: Request) {
  try {
    const userRole = req.headers.get("x-user-role");
    if (!["ADMIN", "EMPLOYEE"].includes(userRole || "")) {
      return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    // Test Requests badge counts PO-based TestRequest rows awaiting approval
    // (the model the /test-requests page actually renders). The sidebar badge
    // previously pointed at the legacy FuzeTestRequest table which produced a
    // number that never matched the on-page "Awaiting Approval" stat card.
    //
    // suspectEmailTypos (P16.6 T4) shares the same Levenshtein-distance-2
    // helper as /api/admin/suspect-email-typos + the weekly cron — single
    // source of truth in src/lib/suspect-email-typos.ts.
    const [accessRequests, brandRequests, factoryRequests, testRequests, suspectEmailTypos] = await Promise.all([
      prisma.accessRequest.count({ where: { status: "PENDING" } }),
      prisma.accessRequest.count({ where: { status: "PENDING", requestType: "BRAND" } }),
      prisma.accessRequest.count({ where: { status: "PENDING", requestType: "FACTORY" } }),
      prisma.testRequest.count({ where: { status: "PENDING_APPROVAL" } }).catch(() => 0),
      countSuspectPairs().catch(() => 0),
    ]);

    return NextResponse.json({
      ok: true,
      accessRequests,
      brandRequests,
      factoryRequests,
      testRequests,
      suspectEmailTypos,
      total: accessRequests + testRequests + suspectEmailTypos,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
