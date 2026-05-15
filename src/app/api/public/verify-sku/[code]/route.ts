// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/public/verify-sku/[code]
 *
 * BONUS-1 — public hangtag-QR verification. No auth required. The
 * code is either a FUZE number (e.g. "2504") or a customer-defined
 * fabric code (case-insensitive).
 *
 * Returns brand + factory + tier + latest brand-visible TestRun.
 * Returns 404 (not just an empty payload) when the fabric can't be
 * resolved so the page can show a clean "this isn't a FUZE-certified
 * SKU" state.
 */

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const trimmed = (code || "").trim();
  if (!trimmed) {
    return NextResponse.json({ ok: false, error: "Missing code" }, { status: 400 });
  }

  const fuzeNum = /^[0-9]{1,7}$/.test(trimmed) ? parseInt(trimmed, 10) : null;

  // Prefer FUZE number match (the canonical hangtag id). Fall back to
  // customer / factory code matches.
  let fabric: any = null;
  if (fuzeNum != null) {
    fabric = await prisma.fabric.findFirst({
      where: { fuzeNumber: fuzeNum },
      select: {
        id: true,
        fuzeNumber: true,
        customerCode: true,
        factoryCode: true,
        construction: true,
        color: true,
        targetFuzeTier: true,
        brand: { select: { id: true, name: true, requiredFuzeTier: true } },
        factory: { select: { id: true, name: true, country: true } },
      },
    });
  }
  if (!fabric) {
    fabric = await prisma.fabric.findFirst({
      where: {
        OR: [
          { customerCode: { equals: trimmed, mode: "insensitive" } },
          { factoryCode: { equals: trimmed, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        fuzeNumber: true,
        customerCode: true,
        factoryCode: true,
        construction: true,
        color: true,
        targetFuzeTier: true,
        brand: { select: { id: true, name: true, requiredFuzeTier: true } },
        factory: { select: { id: true, name: true, country: true } },
      },
    });
  }
  if (!fabric) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  // Most recent brand-visible TestRun across this fabric's submissions
  // gives us the "ICP validated on {date} at {lab}" claim that anchors
  // the verification page.
  const latestTestRun = await prisma.testRun.findFirst({
    where: {
      brandVisible: true,
      submission: { fabricId: fabric.id },
    },
    orderBy: { testDate: "desc" },
    select: {
      id: true,
      testType: true,
      testDate: true,
      lab: { select: { name: true, country: true } },
      testReportNumber: true,
    },
  });

  // FUZE certifications are static + brand-agnostic. Source of truth is
  // CLAUDE.md / fuze-knowledge.ts. We hard-code here so the public page
  // doesn't have to round-trip another endpoint for the chip strip.
  const certifications = [
    { name: "OEKO-TEX Standard 100 Class I", icon: "🧵" },
    { name: "bluesign® approved", icon: "🌊" },
    { name: "EPA registered (federal)", icon: "🇺🇸" },
    { name: "California EPA approved", icon: "🐻" },
    { name: "PFAS-free", icon: "💧" },
  ];

  const tier =
    fabric.targetFuzeTier ||
    fabric.brand?.requiredFuzeTier ||
    null;

  return NextResponse.json({
    ok: true,
    fabric: {
      id: fabric.id,
      fuzeNumber: fabric.fuzeNumber,
      customerCode: fabric.customerCode,
      factoryCode: fabric.factoryCode,
      construction: fabric.construction,
      color: fabric.color,
      tier,
    },
    brand: fabric.brand
      ? { id: fabric.brand.id, name: fabric.brand.name }
      : null,
    factory: fabric.factory
      ? { id: fabric.factory.id, name: fabric.factory.name, country: fabric.factory.country }
      : null,
    latestTestRun: latestTestRun
      ? {
          id: latestTestRun.id,
          testType: latestTestRun.testType,
          testDate: latestTestRun.testDate?.toISOString() || null,
          labName: latestTestRun.lab?.name || null,
          labCountry: latestTestRun.lab?.country || null,
          reportNumber: latestTestRun.testReportNumber || null,
        }
      : null,
    certifications,
  });
}
