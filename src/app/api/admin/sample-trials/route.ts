// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/* ── GET /api/admin/sample-trials ──
 *  List all sample trials across all factories.
 *  Admin/Employee only. Supports status + factory filters.
 * ────────────────────────────────────────── */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const isAdmin = user.role === "ADMIN" || user.role === "EMPLOYEE";
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const factoryId = url.searchParams.get("factoryId");
    const search = url.searchParams.get("search");

    const where: any = {};

    if (status) where.status = status;
    if (factoryId) where.factoryId = factoryId;
    if (search) {
      where.OR = [
        { fabric: { customerCode: { contains: search, mode: "insensitive" } } },
        { fabric: { construction: { contains: search, mode: "insensitive" } } },
        { factory: { name: { contains: search, mode: "insensitive" } } },
        { brand: { name: { contains: search, mode: "insensitive" } } },
        { notes: { contains: search, mode: "insensitive" } },
        { shippingContactName: { contains: search, mode: "insensitive" } },
      ];
      const numSearch = parseInt(search);
      if (!isNaN(numSearch)) {
        where.OR.push({ fabric: { fuzeNumber: numSearch } });
      }
    }

    const trials = await prisma.sampleTrialRequest.findMany({
      where,
      include: {
        fabric: {
          select: { id: true, fuzeNumber: true, customerCode: true, construction: true, weightGsm: true },
        },
        factory: { select: { id: true, name: true, country: true } },
        brand: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, name: true, email: true } },
        icpLab: { select: { id: true, name: true, city: true, country: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get counts by status for summary
    const statusCounts = await prisma.sampleTrialRequest.groupBy({
      by: ["status"],
      _count: true,
    });

    // Get factories for filter dropdown
    const factories = await prisma.factory.findMany({
      where: { sampleTrials: { some: {} } },
      select: { id: true, name: true, country: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      ok: true,
      trials,
      statusCounts: statusCounts.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}),
      factories,
      total: trials.length,
    });
  } catch (e: any) {
    console.error("Admin sample trials error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
