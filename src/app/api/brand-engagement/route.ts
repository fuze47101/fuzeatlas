// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* ── GET /api/brand-engagement ── list brand engagement scores ────────── */
export async function GET(req: Request) {
  try {
    const userRole = req.headers.get("x-user-role");
    // Only admin/sales roles
    if (!["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"].includes(userRole || "")) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    const url = new URL(req.url);
    const trend = url.searchParams.get("trend");

    const where: any = {};
    if (trend) where.engagementTrend = trend;

    const engagements = await prisma.brandEngagement.findMany({
      where,
      include: {
        brand: { select: { id: true, name: true, pipelineStage: true } },
      },
      orderBy: { overallScore: "desc" },
    });

    return NextResponse.json({
      ok: true,
      engagements,
    });
  } catch (error) {
    console.error("Error fetching brand engagement:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch brand engagement" },
      { status: 500 }
    );
  }
}

/* ── POST /api/brand-engagement ── recalculate scores ────────── */
export async function POST(req: Request) {
  try {
    const userRole = req.headers.get("x-user-role");
    // Only admins can trigger recalculation
    if (userRole !== "ADMIN") {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { action, brandId } = body;

    if (action !== "recalculate") {
      return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
    }

    const brands = brandId
      ? [{ id: brandId }]
      : await prisma.brand.findMany({
          select: { id: true },
        });

    for (const brand of brands) {
      await recalculateBrandEngagement(brand.id);
    }

    return NextResponse.json({
      ok: true,
      message: `Recalculated engagement for ${brands.length} brand(s)`,
    });
  } catch (error) {
    console.error("Error recalculating engagement:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to recalculate engagement" },
      { status: 500 }
    );
  }
}

async function recalculateBrandEngagement(brandId: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  // Get brand data
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    include: {
      notes: { orderBy: { date: "desc" }, take: 1 },
      testRequests: {
        where: { poDate: { gte: ninetyDaysAgo } },
        select: { poDate: true },
      },
      invoices: { select: { paidDate: true, dueDate: true } },
    },
  });

  if (!brand) return;

  // Calculate metrics
  const lastNote = brand.notes[0];
  const daysSinceLastContact = lastNote?.date
    ? Math.floor((Date.now() - lastNote.date.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const testsLast30Days = brand.testRequests.filter((tr) => tr.poDate >= thirtyDaysAgo).length;
  const testsLast90Days = brand.testRequests.length;

  const invoiceData = brand.invoices.map((inv) => {
    const paidDate = inv.paidDate || new Date();
    const dueDate = inv.dueDate || new Date();
    return Math.floor((paidDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
  });

  const avgInvoicePayDays = invoiceData.length > 0
    ? invoiceData.reduce((a, b) => a + b) / invoiceData.length
    : null;

  const overdueInvoices = brand.invoices.filter(
    (inv) => inv.dueDate && inv.dueDate < new Date() && !inv.paidDate
  ).length;

  // Calculate scores
  let communicationScore = 50;
  if (daysSinceLastContact !== null) {
    if (daysSinceLastContact <= 7) {
      communicationScore = 100;
    } else {
      communicationScore = Math.max(0, 100 - (daysSinceLastContact - 7) * 10);
    }
  }

  const testingVelocity = Math.min(100, testsLast30Days * 10);
  const pipelineVelocity = Math.min(100, testsLast90Days * 5);

  let paymentScore = 100;
  if (avgInvoicePayDays && avgInvoicePayDays > 30) {
    paymentScore = Math.max(0, 100 - (avgInvoicePayDays - 30) * 2);
  }
  paymentScore = Math.max(0, paymentScore - overdueInvoices * 15);

  const overallScore = Math.round(
    communicationScore * 0.3 + testingVelocity * 0.25 + pipelineVelocity * 0.25 + paymentScore * 0.2
  );

  let engagementTrend = "STABLE";
  if (overallScore >= 75) engagementTrend = "RISING";
  else if (overallScore < 40) engagementTrend = "DECLINING";
  else if (overdueInvoices > 0 || daysSinceLastContact && daysSinceLastContact > 60)
    engagementTrend = "AT_RISK";

  // Update or create engagement record
  await prisma.brandEngagement.upsert({
    where: { brandId },
    update: {
      overallScore,
      communicationScore,
      testingVelocity,
      pipelineVelocity,
      paymentScore,
      engagementTrend,
      daysSinceLastContact,
      testsLast30Days,
      testsLast90Days,
      avgInvoicePayDays,
      overdueInvoices,
      lastCalculated: new Date(),
    },
    create: {
      brandId,
      overallScore,
      communicationScore,
      testingVelocity,
      pipelineVelocity,
      paymentScore,
      engagementTrend,
      daysSinceLastContact,
      testsLast30Days,
      testsLast90Days,
      avgInvoicePayDays,
      overdueInvoices,
    },
  });
}
