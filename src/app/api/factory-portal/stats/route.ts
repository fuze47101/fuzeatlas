// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { fabricScopeForFactory, submissionScopeForFactory } from "@/lib/acl";

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

    // Stats — use the shared ACL helpers so we count fabrics whose
    // relationship lands on either Fabric.factoryId OR
    // FabricSubmission.factoryId. The previous queries undercounted
    // because intake-submitted fabrics often have a null Fabric.factoryId.
    const activeFabrics = await prisma.fabric.count({
      where: {
        AND: [fabricScopeForFactory(factoryId), { status: "ACTIVE" }],
      },
    });

    const pendingSubmissions = await prisma.fabricSubmission.count({
      where: {
        AND: [submissionScopeForFactory(factoryId), { status: { in: ["SUBMITTED", "IN_REVIEW"] } }],
      },
    });

    const completedTests = await prisma.testRequest.count({
      where: {
        AND: [
          {
            OR: [
              { fabric: { factoryId } },
              { fabric: { submissions: { some: { factoryId } } } },
            ],
          },
          { status: "PASSED_COMPLETE" },
        ],
      },
    });

    const sampleTrials = await prisma.sampleTrialRequest.count({
      where: { factoryId },
    });

    return NextResponse.json({
      ok: true,
      stats: {
        activeFabrics,
        pendingSubmissions,
        completedTests,
        sampleTrials,
      },
    });
  } catch (e: any) {
    console.error("Factory stats error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
