// @ts-nocheck
/**
 * GET /api/fabric-report/[token]
 *
 * Public, token-protected report fetch. Used by /report/[token] (the
 * customer-facing page) and by the email "Open Report" button. No
 * Atlas login required — possession of the token is the credential.
 *
 * Increments viewedCount on every successful fetch and stamps
 * lastViewedAt so admins can see whether the customer actually
 * opened the email.
 *
 * Returns the same shape as /api/admin/fabric-report/[fabricId] so the
 * downstream report page can render unchanged.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const TIER_MG_PER_KG: Record<string, number> = {
  F1: 1.0,
  F2: 0.75,
  F3: 0.5,
  F4: 0.25,
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

    const share = await prisma.fabricReportShare.findUnique({
      where: { token },
    });
    if (!share) {
      return NextResponse.json(
        { ok: false, error: "Report not found" },
        { status: 404 },
      );
    }
    if (share.revokedAt) {
      return NextResponse.json(
        { ok: false, error: "This report link was revoked." },
        { status: 410 },
      );
    }
    if (share.expiresAt && share.expiresAt.getTime() < Date.now()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This report link has expired. Please sign in to FUZE Atlas to access the latest version.",
        },
        { status: 410 },
      );
    }

    // Stamp engagement (fire-and-forget — don't fail the request if
    // this throws).
    prisma.fabricReportShare
      .update({
        where: { id: share.id },
        data: {
          viewedCount: { increment: 1 },
          lastViewedAt: new Date(),
        },
      })
      .catch((e) => console.error("[fabric-report.view] stamp failed:", e));

    // Reuse the same loader logic as the admin endpoint.
    const fabricId = share.fabricId;

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

    const benchTest = await prisma.recipeBenchTest.findFirst({
      where: { fabricId, pickupDryToWetPct: { not: null } },
      orderBy: { testDate: "desc" },
    });

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

    const pickupPct = benchTest?.pickupDryToWetPct ?? null;
    const stockMgPerL = benchTest?.stockMgPerL ?? 30;
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

    const recommendedTier =
      fabric.targetFuzeTier || benchTest?.testedAtTier || share.tier || "F1";

    return NextResponse.json({
      ok: true,
      share: {
        recipientName: share.recipientName,
        recipientEmail: share.recipientEmail,
        sentAt: share.sentAt,
        expiresAt: share.expiresAt,
      },
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
      // Token route never gates the report on `safeForExternal` — the
      // admin already chose to send it. If it's bad, it's bad.
      safeForExternal: true,
      missingForExternal: [],
    });
  } catch (e: any) {
    console.error("[fabric-report.public] error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
