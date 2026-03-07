// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "FACTORY_USER" && user.role !== "FACTORY_MANAGER")) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    // Get factory ID from user
    const factoryId = user.factoryId;
    if (!factoryId) {
      return NextResponse.json({ ok: false, error: "Factory not found" }, { status: 404 });
    }

    // Get stats
    const activeFabrics = await prisma.fabric.count({
      where: {
        factoryId,
        status: "ACTIVE",
      },
    });

    const pendingSubmissions = await prisma.fabricSubmission.count({
      where: {
        fabric: { factoryId },
        status: { in: ["SUBMITTED", "IN_REVIEW"] },
      },
    });

    const completedTests = await prisma.testRequest.count({
      where: {
        fabric: { factoryId },
        status: "PASSED_COMPLETE",
      },
    });

    return NextResponse.json({
      ok: true,
      stats: {
        activeFabrics,
        pendingSubmissions,
        completedTests,
      },
    });
  } catch (e: any) {
    console.error("Factory stats error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
