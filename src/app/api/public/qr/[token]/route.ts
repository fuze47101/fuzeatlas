// @ts-nocheck
/**
 * GET /api/public/qr/[token] — Phase 12B.
 *
 * Public, no-auth endpoint. Increments HangtagQR.scannedCount,
 * stamps firstScannedAt (first scan only) + lastScannedAt every
 * scan. Returns the product context + most-recent FUZE-validated
 * test result so the public landing page can render it.
 *
 * 404 on unknown token. No cache (every scan must increment).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const hangtag = await prisma.hangtagQR.findUnique({
    where: { token },
    select: {
      id: true,
      productSku: true,
      batchCode: true,
      printedAt: true,
      scannedCount: true,
      firstScannedAt: true,
      brand: {
        select: {
          id: true,
          name: true,
          website: true,
          profile: { select: { publicSlug: true, publicEnabled: true } },
        },
      },
      fabric: {
        select: {
          id: true,
          fuzeNumber: true,
          construction: true,
          weightGsm: true,
          fabricCategory: true,
        },
      },
    },
  });
  if (!hangtag) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const now = new Date();
  await prisma.hangtagQR.update({
    where: { id: hangtag.id },
    data: {
      scannedCount: { increment: 1 },
      lastScannedAt: now,
      ...(hangtag.firstScannedAt ? {} : { firstScannedAt: now }),
    },
  });

  // Most-recent FUZE-validated test result on this fabric. We look
  // for a brandApproved TestRun first; if none, we surface the most
  // recent brand-visible one as a softer signal.
  let mostRecentTest: any = null;
  let fuzeTier: string | null = null;
  let washCount: number | null = null;
  if (hangtag.fabric?.id) {
    const tr = await prisma.testRun.findFirst({
      where: {
        submission: { fabricId: hangtag.fabric.id, brandId: hangtag.brand.id },
        brandApprovalStatus: "APPROVED",
      },
      orderBy: { testDate: "desc" },
      select: {
        id: true,
        testType: true,
        testMethodStd: true,
        testDate: true,
        washCount: true,
        submission: { select: { fuzeTier: true } },
        icpResult: { select: { agValue: true, unit: true } },
        abResult: { select: { result1: true, organism1: true, pass: true } },
      },
    });
    if (tr) {
      mostRecentTest = {
        type: tr.testType,
        method: tr.testMethodStd,
        date: tr.testDate,
        washCount: tr.washCount,
        result:
          tr.icpResult?.agValue != null
            ? `Ag ${tr.icpResult.agValue.toFixed(2)} ${tr.icpResult.unit || "ppm"}`
            : tr.abResult?.result1 != null
              ? `${tr.abResult.result1.toFixed(2)} log reduction${tr.abResult.organism1 ? ` vs ${tr.abResult.organism1}` : ""}`
              : "Verified",
      };
      fuzeTier = tr.submission?.fuzeTier || null;
      washCount = tr.washCount || null;
    }
  }

  // Sustainability impact: FUZE liters consumed across this fabric.
  let fuzeLitersConsumed: number | null = null;
  if (hangtag.fabric?.id) {
    const consumption = await prisma.fuzeConsumption.aggregate({
      where: { fabricId: hangtag.fabric.id },
      _sum: { litersUsed: true },
    });
    fuzeLitersConsumed = consumption._sum.litersUsed || null;
  }

  return NextResponse.json(
    {
      ok: true,
      brand: {
        name: hangtag.brand.name,
        publicSlug:
          hangtag.brand.profile?.publicEnabled
            ? hangtag.brand.profile?.publicSlug
            : null,
      },
      product: {
        sku: hangtag.productSku,
        batchCode: hangtag.batchCode,
        printedAt: hangtag.printedAt,
      },
      fabric: hangtag.fabric
        ? {
            fuzeNumber: hangtag.fabric.fuzeNumber,
            construction: hangtag.fabric.construction,
            weightGsm: hangtag.fabric.weightGsm,
            category: hangtag.fabric.fabricCategory,
          }
        : null,
      tier: fuzeTier,
      mostRecentTest,
      sustainability: {
        fuzeLitersConsumed,
      },
      scan: {
        count: hangtag.scannedCount + 1,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
