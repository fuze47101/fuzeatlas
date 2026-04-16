// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/distributor-portal/test-reports
 * Returns test report documents uploaded by or associated with this distributor
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const isDistributor = user.role === "DISTRIBUTOR_USER";
    const isAdmin = ["ADMIN", "EMPLOYEE"].includes(user.role);
    if (!isDistributor && !isAdmin) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    // Get documents uploaded by this user (REPORT kind), or all for admin
    const where: any = { kind: "REPORT" };
    if (!isAdmin) {
      where.uploadedById = user.id;
    }

    const docs = await prisma.document.findMany({
      where,
      select: {
        id: true,
        filename: true,
        kind: true,
        createdAt: true,
        testRun: {
          select: {
            id: true,
            testType: true,
            reportNumber: true,
            testMethodStd: true,
            lab: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const reports = docs.map((d) => ({
      id: d.id,
      filename: d.filename,
      reportNumber: d.testRun?.reportNumber || null,
      testType: d.testRun?.testType || null,
      testMethodStd: d.testRun?.testMethodStd || null,
      labName: d.testRun?.lab?.name || null,
      linked: !!d.testRun,
      createdAt: d.createdAt,
    }));

    return NextResponse.json({ ok: true, reports });
  } catch (e: any) {
    console.error("Distributor test-reports error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
