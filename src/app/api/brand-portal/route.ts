// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/* ── GET /api/brand-portal ── Brand user: get their brand + fabrics + submissions */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    // For brand users, scope to their brand; for internal users, require brandId param
    let brandId = user.brandId;
    if (!brandId && (user.role === "ADMIN" || user.role === "EMPLOYEE")) {
      // Admins can access any brand - pass brandId as query param
      return NextResponse.json({ ok: false, error: "brandId required for admin access" }, { status: 400 });
    }
    if (!brandId) {
      return NextResponse.json({ ok: false, error: "No brand associated with this account" }, { status: 403 });
    }

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { id: true, name: true, pipelineStage: true, country: true, segment: true },
    });

    if (!brand) {
      return NextResponse.json({ ok: false, error: "Brand not found" }, { status: 404 });
    }

    // Get fabrics for this brand
    const fabrics = await prisma.fabric.findMany({
      where: { brandId },
      include: {
        factory: { select: { id: true, name: true, country: true } },
        contents: { select: { material: true, percent: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get submissions for this brand
    const submissions = await prisma.fabricSubmission.findMany({
      where: { brandId },
      include: {
        fabric: { select: { id: true, fuzeNumber: true, customerCode: true, construction: true, weightGsm: true } },
        factory: { select: { id: true, name: true } },
        _count: { select: { testRuns: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Summary stats
    const stats = {
      totalFabrics: fabrics.length,
      totalSubmissions: submissions.length,
      submissionsByStatus: {} as Record<string, number>,
      testsPassed: 0,
      testsPending: 0,
    };

    for (const s of submissions) {
      const st = s.status || "Pending";
      stats.submissionsByStatus[st] = (stats.submissionsByStatus[st] || 0) + 1;
      if (s.testStatus === "PASSED" || s.icpPassed) stats.testsPassed++;
      else if (s.testStatus === "PENDING" || !s.testStatus) stats.testsPending++;
    }

    return NextResponse.json({
      ok: true,
      brand,
      fabrics: fabrics.map((f) => ({
        id: f.id,
        fuzeNumber: f.fuzeNumber,
        customerCode: f.customerCode,
        factoryCode: f.factoryCode,
        construction: f.construction,
        color: f.color,
        weightGsm: f.weightGsm,
        widthInches: f.widthInches,
        yarnType: f.yarnType,
        finishNote: f.finishNote,
        note: f.note,
        factory: f.factory,
        contents: f.contents,
        submissionCount: f._count.submissions,
        createdAt: f.createdAt,
      })),
      submissions: submissions.map((s) => ({
        id: s.id,
        fuzeFabricNumber: s.fuzeFabricNumber,
        customerFabricCode: s.customerFabricCode,
        status: s.status || "Pending",
        testStatus: s.testStatus || "Pending",
        applicationMethod: s.applicationMethod,
        washTarget: s.washTarget,
        developmentStage: s.developmentStage,
        progressPercent: s.progressPercent,
        fabric: s.fabric,
        factory: s.factory,
        testCount: s._count.testRuns,
        icpPassed: s.icpPassed,
        abPassed: s.abPassed,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
      stats,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

/* ── POST /api/brand-portal ── Brand user: create a new fabric for their brand */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const brandId = user.brandId;
    if (!brandId && user.role !== "ADMIN" && user.role !== "EMPLOYEE") {
      return NextResponse.json({ ok: false, error: "No brand associated" }, { status: 403 });
    }

    const body = await req.json();
    const {
      customerCode, factoryCode, construction, color,
      weightGsm, widthInches, yarnType, finishNote, note,
      factoryId, contents, // contents: [{material, percent}]
      // For admin override
      brandIdOverride,
      // FUZE cost calc fields (saved on submission)
      fuzeTier, applicationMethod,
    } = body;

    const targetBrandId = (user.role === "ADMIN" || user.role === "EMPLOYEE")
      ? (brandIdOverride || brandId)
      : brandId;

    if (!targetBrandId) {
      return NextResponse.json({ ok: false, error: "brandId required" }, { status: 400 });
    }

    // Auto-assign next FUZE number
    const lastFabric = await prisma.fabric.findFirst({
      where: { fuzeNumber: { not: null } },
      orderBy: { fuzeNumber: "desc" },
      select: { fuzeNumber: true },
    });
    const nextFuzeNumber = (lastFabric?.fuzeNumber || 0) + 1;

    const fabric = await prisma.fabric.create({
      data: {
        fuzeNumber: nextFuzeNumber,
        customerCode: customerCode || null,
        factoryCode: factoryCode || null,
        construction: construction || null,
        color: color || null,
        weightGsm: weightGsm ? parseFloat(weightGsm) : null,
        widthInches: widthInches ? parseFloat(widthInches) : null,
        yarnType: yarnType || null,
        finishNote: finishNote || null,
        note: note || null,
        brandId: targetBrandId,
        factoryId: factoryId || null,
      },
    });

    // Add fabric contents if provided
    if (contents && Array.isArray(contents) && contents.length > 0) {
      await prisma.fabricContent.createMany({
        data: contents
          .filter((c: any) => c.material)
          .map((c: any) => ({
            fabricId: fabric.id,
            material: c.material,
            percent: c.percent ? parseFloat(c.percent) : null,
          })),
      });
    }

    return NextResponse.json({ ok: true, fabric: { ...fabric, fuzeNumber: nextFuzeNumber } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
