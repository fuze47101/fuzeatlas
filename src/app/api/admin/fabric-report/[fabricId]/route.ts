// @ts-nocheck
/**
 * ═══════════════════════════════════════════════════════════════════════
 *  FULL APPLICATION REPORT — DATA ENDPOINT
 *
 *  Returns everything the customer-facing Full Application Report needs
 *  in a single call: fabric identity, latest validated bench-test recipe,
 *  every in-house Sample Application against this fabric, and every lab
 *  ICP / antibacterial test run that's tied to it via FabricSubmission.
 *
 *  This is the join the print page (and the future PDF generator) read
 *  from. Phase 2 of the Penfabric (Raihana) escalation — Andrew #102:
 *  "the full report to them with dilution based on recipe testing AND
 *  validation with a further lab validated ICP verification of the test
 *  recipe that we did in house at 1 ppm."
 *
 *  Auth: any authenticated internal user (read-only). The token-protected
 *  external view lives at /api/fabric-report/[token]/route.ts and reuses
 *  this loader internally.
 * ═══════════════════════════════════════════════════════════════════════
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// Tier → mg/kg OWF (on-weight-of-fabric) target deposit. Mirrors the
// constants used in the recipe calculator + sample application API. If
// these ever change, change them in lockstep across all three locations
// — there is no single source of truth yet.
const TIER_MG_PER_KG: Record<string, number> = {
  F1: 1.0,
  F2: 0.75,
  F3: 0.5,
  F4: 0.25,
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ fabricId: string }> },
) {
  try {
    const { fabricId } = await params;

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
    const allowed = [
      "ADMIN",
      "EMPLOYEE",
      "SALES_MANAGER",
      "SALES_REP",
      "BD_REP",
      "LAB_USER",
      "LAB_MANAGER",
    ];
    if (!allowed.includes(user.role)) {
      return NextResponse.json(
        { ok: false, error: `Role ${user.role} not permitted` },
        { status: 403 },
      );
    }

    // ─── Fabric identity + brand/factory + contents ───────────────
    const fabric = await prisma.fabric.findUnique({
      where: { id: fabricId },
      include: {
        brand: { select: { id: true, name: true, website: true } },
        factory: { select: { id: true, name: true } },
        contents: true,
      },
    });
    if (!fabric) {
      return NextResponse.json(
        { ok: false, error: "Fabric not found" },
        { status: 404 },
      );
    }

    // ─── Latest validated bench test for this fabric ──────────────
    // "Validated" = pickup% measured. Pre-measurement bench tests can't
    // drive a recipe so we exclude them.
    const benchTest = await prisma.recipeBenchTest.findFirst({
      where: { fabricId, pickupDryToWetPct: { not: null } },
      orderBy: { testDate: "desc" },
    });

    // ─── In-house sample applications (pad/dry validation chain) ──
    const sampleApplications = await prisma.sampleApplication.findMany({
      where: { fabricId },
      orderBy: { createdAt: "desc" },
      include: {
        benchTest: {
          select: {
            id: true,
            testNumber: true,
            testDate: true,
            applicationMethod: true,
            pickupDryToWetPct: true,
            stockMgPerL: true,
          },
        },
      },
    });

    // ─── Lab-side test runs via FabricSubmission ───────────────────
    // The customer's actual fabric submitted to a third-party lab. We
    // pull every TestRun across every submission tied to this fabric.
    // This is what powers the "Independent Lab ICP Verification" panel.
    const submissions = await prisma.fabricSubmission.findMany({
      where: { fabricId },
      orderBy: { createdAt: "desc" },
      include: {
        testRuns: {
          orderBy: { testDate: "desc" },
          include: {
            icpResult: true,
            abResult: true,
            fungalResult: true,
            odorResult: true,
            lab: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Flatten test runs across all submissions for the report panel,
    // but keep the parent submission link so we can show "submitted on
    // X date with PO Y" provenance.
    const labTestRuns = submissions.flatMap((s: any) =>
      (s.testRuns || []).map((tr: any) => ({
        ...tr,
        submission: {
          id: s.id,
          fuzeFabricNumber: s.fuzeFabricNumber,
          customerFabricCode: s.customerFabricCode,
          factoryFabricCode: s.factoryFabricCode,
          applicationDate: s.applicationDate,
          treatmentLocation: s.treatmentLocation,
          status: s.status,
        },
      })),
    );

    // ─── FUZE Required matrix — Andrew #102: 100/200/300/400 L baths
    //     × F1/F2/F3/F4 tiers. Computed server-side off the bench
    //     test's pickup % so the print page doesn't have to repeat the
    //     math. mL FUZE stock / mL DI / final mg/kg OWF in one row.
    // ─────────────────────────────────────────────────────────────
    const pickupPct = benchTest?.pickupDryToWetPct ?? null;
    const stockMgPerL = benchTest?.stockMgPerL ?? 30; // default per CLAUDE.md
    const bathVolumes = [100, 200, 300, 400];
    const tiers = ["F1", "F2", "F3", "F4"];
    const fuzeMatrix = bathVolumes.map((bathL) => {
      const row: any = { bathL, tiers: {} };
      for (const tier of tiers) {
        const tierMg = TIER_MG_PER_KG[tier];
        if (!pickupPct || !tierMg) {
          row.tiers[tier] = null;
          continue;
        }
        const bathMgPerL = tierMg / (pickupPct / 100);
        const fuzeMl = (bathMgPerL * bathL * 1000) / stockMgPerL;
        const waterMl = bathL * 1000 - fuzeMl;
        row.tiers[tier] = {
          tierMgPerKg: tierMg,
          bathMgPerL: Number(bathMgPerL.toFixed(3)),
          // Display-friendly conversions: ppm in the bath = mg/L by
          // definition (1 ppm in water ≈ 1 mg/L), and ppm on fabric =
          // mg/kg by the same logic.
          bathPpm: Number(bathMgPerL.toFixed(3)),
          fabricPpm: Number(tierMg.toFixed(3)),
          fuzeMl: Number(fuzeMl.toFixed(2)),
          fuzeL: Number((fuzeMl / 1000).toFixed(3)),
          waterMl: Number(waterMl.toFixed(2)),
          waterL: Number((waterMl / 1000).toFixed(3)),
        };
      }
      return row;
    });

    // ─── Externally-shareable readiness gate ──────────────────────
    // Mirrors the red banner logic on the recipe-calculator print
    // card. If anything customer-identifying or recipe-driving is
    // missing, the report should not be sent externally yet.
    const missingForExternal: string[] = [];
    if (!fabric.brand?.name) missingForExternal.push("Brand");
    if (!fabric.customerReference && !fabric.customerCode) {
      missingForExternal.push("Customer reference (or customer item #)");
    }
    if (!fabric.factoryCode) missingForExternal.push("Factory item #");
    if (
      !fabric.fabricCategory &&
      !fabric.construction &&
      !benchTest?.fabricType
    ) {
      missingForExternal.push("Construction (knit / woven / nonwoven)");
    }
    const hasFiber =
      (fabric.contents && fabric.contents.length > 0) ||
      !!fabric.yarnType ||
      !!benchTest?.fiberContent;
    if (!hasFiber) missingForExternal.push("Fiber content / yarn");
    if (!benchTest) {
      missingForExternal.push("Validated bench test (run Recipe Calculator)");
    }
    const safeForExternal = missingForExternal.length === 0;

    // ─── Recommended tier — pull from fabric.targetFuzeTier first,
    //     fall back to bench test, default F1.
    const recommendedTier =
      fabric.targetFuzeTier ||
      benchTest?.testedAtTier ||
      "F1";

    // ─── Live shares for this fabric (for the admin "Send" widget)
    const reportShares = await prisma.fabricReportShare.findMany({
      where: { fabricId },
      orderBy: { sentAt: "desc" },
      take: 20,
    });

    return NextResponse.json({
      ok: true,
      fabric,
      benchTest,
      sampleApplications,
      submissions,
      labTestRuns,
      fuzeMatrix,
      tierMgPerKg: TIER_MG_PER_KG,
      stockMgPerL,
      pickupPct,
      recommendedTier,
      safeForExternal,
      missingForExternal,
      reportShares,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e.message },
      { status: 500 },
    );
  }
}
