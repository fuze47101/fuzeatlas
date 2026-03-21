// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* ── POST /api/tests/batch-stamp ── stamp/unstamp multiple tests for brand visibility */
export async function POST(req: Request) {
  try {
    const userId = req.headers.get("x-user-id");
    const userRole = req.headers.get("x-user-role");

    if (!["ADMIN", "EMPLOYEE", "TESTING_MANAGER"].includes(userRole || "")) {
      return NextResponse.json(
        { ok: false, error: "Only admins and testing managers can batch stamp tests" },
        { status: 403 }
      );
    }

    const { testRunIds, visible } = await req.json();

    if (!Array.isArray(testRunIds) || testRunIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: "testRunIds array is required" },
        { status: 400 }
      );
    }

    const stamp = visible !== false; // default to stamping (true)

    const result = await prisma.testRun.updateMany({
      where: { id: { in: testRunIds } },
      data: {
        brandVisible: stamp,
        brandApprovedById: stamp ? userId : null,
        brandApprovedAt: stamp ? new Date() : null,
      },
    });

    return NextResponse.json({
      ok: true,
      updated: result.count,
      action: stamp ? "stamped" : "unstamped",
    });
  } catch (err: any) {
    console.error("Batch stamp error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
