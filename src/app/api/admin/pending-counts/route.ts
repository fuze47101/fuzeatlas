// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* ── GET /api/admin/pending-counts ── Returns pending counts for admin badges ── */
export async function GET(req: Request) {
  try {
    const userRole = req.headers.get("x-user-role");
    if (!["ADMIN", "EMPLOYEE"].includes(userRole || "")) {
      return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const [accessRequests, brandRequests, factoryRequests, testRequests] = await Promise.all([
      prisma.accessRequest.count({ where: { status: "PENDING" } }),
      prisma.accessRequest.count({ where: { status: "PENDING", requestType: "BRAND" } }),
      prisma.accessRequest.count({ where: { status: "PENDING", requestType: "FACTORY" } }),
      prisma.fuzeTestRequest.count({ where: { status: "PENDING" } }).catch(() => 0),
    ]);

    return NextResponse.json({
      ok: true,
      accessRequests,
      brandRequests,
      factoryRequests,
      testRequests,
      total: accessRequests + testRequests,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
