// @ts-nocheck
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const sows = await prisma.sOW.findMany({
      include: {
        brand: { select: { id: true, name: true, pipelineStage: true } },
        milestones: { orderBy: { sortOrder: "asc" } },
        _count: { select: { documents: true, milestones: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, sows });
  } catch (e: any) {
    console.error("SOW API error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      brandId, title, status,
      // Commercial Ownership
      executiveSponsor, factoryId, distributorId, salesRepName,
      // End Use Definition
      garmentSku, fabricType, gsm, applicationLevel, targetLaunchSeason, retailChannel,
      // Volume Forecast
      projectedAnnualUnits, garmentWeight, calculatedAnnualLiters,
      projectedAnnualRevenue, targetCommercializationDate,
      // Success Criteria
      icpTarget, antimicrobialStandard, requiredLogReduction, washDurability, approvedTestingLab,
      // Financial Participation
      financialParticipation, developmentRetainer,
      // Commitment
      commitmentVolumeLiters,
      // Existing fields
      expectations, performanceCriteria, pricingTerms, costControls,
      signatory, signatoryTitle, signatoryEmail,
    } = body;

    if (!brandId) {
      return NextResponse.json({ ok: false, error: "Brand is required" }, { status: 400 });
    }

    // Stage 0 gate check: require executive sponsor, SKU, launch season, factory, volume
    const gateErrors: string[] = [];
    if (!executiveSponsor) gateErrors.push("Executive Sponsor (Director+) is required");
    if (!garmentSku) gateErrors.push("Garment SKU/Style # is required");
    if (!targetLaunchSeason) gateErrors.push("Target Launch Season is required");
    if (!factoryId) gateErrors.push("Factory is required");
    if (!projectedAnnualUnits && !calculatedAnnualLiters) gateErrors.push("Volume forecast is required");

    if (gateErrors.length > 0) {
      return NextResponse.json({
        ok: false,
        error: "Stage 0 - Commercial Qualification requirements not met",
        gateErrors,
      }, { status: 422 });
    }

    // Check minimum revenue threshold ($25,000)
    const revenue = projectedAnnualRevenue ? parseFloat(projectedAnnualRevenue) : 0;
    let revenueWarning = null;
    if (revenue > 0 && revenue < 25000) {
      revenueWarning = "Below $25,000 minimum revenue threshold. Requires executive override or paid development classification.";
    }

    // Store extended SOW data in the existing fields + JSON
    const sow = await prisma.sOW.create({
      data: {
        brandId,
        title: title || `SOW - ${new Date().toISOString().split("T")[0]}`,
        status: status || "DRAFT",
        expectations: expectations || null,
        performanceCriteria: JSON.stringify({
          icpTarget, antimicrobialStandard, requiredLogReduction, washDurability, approvedTestingLab,
        }),
        pricingTerms: JSON.stringify({
          financialParticipation, developmentRetainer,
          projectedAnnualRevenue, commitmentVolumeLiters,
        }),
        costControls: JSON.stringify({
          executiveSponsor, factoryId, distributorId, salesRepName,
          garmentSku, fabricType, gsm, applicationLevel,
          targetLaunchSeason, retailChannel,
          projectedAnnualUnits, garmentWeight, calculatedAnnualLiters,
          targetCommercializationDate,
        }),
        signatory: signatory || null,
        signatoryTitle: signatoryTitle || null,
        signatoryEmail: signatoryEmail || null,
        milestones: {
          create: [
            { title: "Stage 0 - Commercial Qualification", description: "Executive sponsor, SKU, factory, volume defined", sortOrder: 0, completedAt: new Date() },
            { title: "Stage 1 - Technical Feasibility", description: "Signed SOW, LOI, success criteria, lab protocol, financial participation", sortOrder: 1 },
            { title: "Stage 2 - Commercial Commitment", description: "Validation successful, brand/factory confirm intent to commercialize within 6 months", sortOrder: 2 },
            { title: "Stage 3 - Production Integration", description: "Pilot validation, ICP confirmation, distributor stocking plan, confirmed forecast", sortOrder: 3 },
          ],
        },
      },
      include: { milestones: true },
    });

    return NextResponse.json({ ok: true, sow, revenueWarning });
  } catch (e: any) {
    console.error("SOW create error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
