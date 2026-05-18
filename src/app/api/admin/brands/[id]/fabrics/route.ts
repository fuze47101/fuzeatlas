// @ts-nocheck
/**
 * GET /api/admin/brands/[id]/fabrics
 *
 * Brand fabric portfolio — the data Tina previously maintained in a
 * per-brand spreadsheet (SanMar / KUIU / etc.). Returns every fabric
 * linked to the brand grouped by factory, with rollup fields:
 *
 *   - trial completion status (derived from FabricSubmission.status)
 *   - ICP-result-present boolean (any TestRun with IcpResult.agValue)
 *   - AM-result-present boolean (any TestRun with AntibacterialResult)
 *   - most-recent ICP ppm value (numeric)
 *   - most-recent test date
 *   - developmentStatus (the Tina workflow state)
 *
 * Scoped to ADMIN/EMPLOYEE/SALES_MANAGER. Brand-user mirror lives at
 * /api/brand-portal/fabrics-portfolio (scoped to their own brand).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const ADMIN_ROLES = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "TESTING_MANAGER", "FABRIC_MANAGER"];

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!ADMIN_ROLES.includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const brand = await prisma.brand.findUnique({
      where: { id },
      select: { id: true, name: true, pipelineStage: true },
    });
    if (!brand) {
      return NextResponse.json({ ok: false, error: "Brand not found" }, { status: 404 });
    }

    // Pull every fabric tied to this brand — directly via Fabric.brandId
    // OR via a FabricSubmission with the brand stamped on it (the
    // common case for intake-routed fabrics where Fabric.brandId is null).
    const fabrics = await prisma.fabric.findMany({
      where: {
        OR: [
          { brandId: brand.id },
          { submissions: { some: { brandId: brand.id } } },
        ],
      },
      select: {
        id: true,
        fuzeNumber: true,
        customerCode: true,
        factoryCode: true,
        customerReference: true,
        construction: true,
        color: true,
        weightGsm: true,
        yarnType: true,
        endUse: true,
        quantityType: true,
        targetFuzeTier: true,
        fabricCategory: true,
        developmentStatus: true,
        note: true,
        createdAt: true,
        updatedAt: true,
        factory: { select: { id: true, name: true, country: true } },
        submissions: {
          where: { brandId: brand.id },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            createdAt: true,
            factoryId: true,
            factory: { select: { id: true, name: true } },
            brandApprovalStatus: true,
          },
        },
        // TestRuns are nested under submissions in the schema (TestRun has
        // submissionId, not fabricId directly). Pull through all submissions
        // for this fabric that belong to this brand.
      },
      orderBy: [{ factoryId: "asc" }, { factoryCode: "asc" }],
    });

    // For each fabric, fetch its most-recent test results separately.
    // Avoids ballooning the include tree on the main query.
    const fabricIds = fabrics.map((f) => f.id);
    const testRuns =
      fabricIds.length > 0
        ? await prisma.testRun.findMany({
            where: {
              submission: {
                fabricId: { in: fabricIds },
                brandId: brand.id,
              },
            },
            select: {
              id: true,
              testDate: true,
              testType: true,
              submission: { select: { fabricId: true } },
              icpResult: { select: { agValue: true, unit: true } },
              abResult: { select: { id: true, percentReduction: true, pass: true } },
            },
            orderBy: { testDate: "desc" },
          })
        : [];

    // Roll up per fabric.
    const runsByFabric: Record<string, typeof testRuns> = {};
    for (const t of testRuns) {
      const fid = t.submission?.fabricId;
      if (!fid) continue;
      (runsByFabric[fid] ||= []).push(t);
    }

    // Compose the response.
    const rows = fabrics.map((f) => {
      const runs = runsByFabric[f.id] || [];
      const latestIcp = runs.find((r) => r.icpResult?.agValue != null);
      const latestAb = runs.find((r) => r.abResult);
      const latestRun = runs[0];
      const sub = f.submissions[0] || null;
      const trialComplete =
        sub?.status === "COMPLETED" ||
        sub?.status === "COMPLETE" ||
        sub?.brandApprovalStatus === "APPROVED";

      return {
        id: f.id,
        fuzeNumber: f.fuzeNumber,
        factory: f.factory || sub?.factory || null,
        factoryCode: f.factoryCode,
        customerCode: f.customerCode,
        customerReference: f.customerReference,
        type: f.quantityType, // ACTUAL / FORECAST / DEVELOPMENT / RD
        content: f.construction,
        weightGsm: f.weightGsm,
        targetFuzeTier: f.targetFuzeTier,
        developmentStatus: f.developmentStatus,
        note: f.note,
        // Rollup booleans
        trialComplete,
        hasIcpResult: !!latestIcp,
        hasAmResult: !!latestAb,
        // Most-recent values
        latestIcpValue: latestIcp?.icpResult?.agValue ?? null,
        latestIcpUnit: latestIcp?.icpResult?.unit || "ppm",
        latestTestDate: latestRun?.testDate ?? null,
        testRunCount: runs.length,
        // Reference IDs for drill-down
        submissionId: sub?.id ?? null,
        submissionStatus: sub?.status ?? null,
      };
    });

    // Group by factory for the view layout.
    const grouped: Record<string, { factory: { id: string | null; name: string }; rows: typeof rows }> = {};
    for (const r of rows) {
      const key = r.factory?.id || "_none";
      if (!grouped[key]) {
        grouped[key] = {
          factory: { id: r.factory?.id || null, name: r.factory?.name || "Unassigned" },
          rows: [],
        };
      }
      grouped[key].rows.push(r);
    }

    return NextResponse.json({
      ok: true,
      brand,
      total: rows.length,
      rows,
      grouped: Object.values(grouped).sort((a, b) => a.factory.name.localeCompare(b.factory.name)),
      generatedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error("[admin/brands/[id]/fabrics] failed:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Server error" },
      { status: 500 },
    );
  }
}
