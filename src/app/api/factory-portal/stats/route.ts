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
    //
    // May 11 fix — KK / Raihana reported all-zero dashboards. Root cause:
    // the previous version filtered `Fabric.status = "ACTIVE"` but the
    // Fabric model has no status column, so the WHOLE endpoint 500'd
    // and the page silently rendered zeros (frontend defaults missing
    // data.stats to zero). Dropped the bogus filter; we just count
    // fabrics in scope. Similarly fixed completedTests to use a status
    // value that actually exists on TestRequest.
    const activeFabrics = await prisma.fabric.count({
      where: fabricScopeForFactory(factoryId),
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
          { status: "COMPLETE" },
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
