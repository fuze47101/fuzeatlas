// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/* ── GET  /api/factory-portal/sample-trial ── list trials for factory ── */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const isAdmin = user.role === "ADMIN" || user.role === "EMPLOYEE";
    const isFactory = user.role === "FACTORY_USER" || user.role === "FACTORY_MANAGER";

    if (!isAdmin && !isFactory) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const where: any = {};
    if (isFactory) {
      if (!user.factoryId) return NextResponse.json({ ok: false, error: "No factory linked" }, { status: 400 });
      where.factoryId = user.factoryId;
    }

    // Optional status filter
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    if (status) where.status = status;

    const trials = await prisma.sampleTrialRequest.findMany({
      where,
      include: {
        fabric: {
          select: { id: true, fuzeNumber: true, customerCode: true, factoryCode: true, construction: true, weightGsm: true },
        },
        brand: { select: { id: true, name: true } },
        factory: { select: { id: true, name: true, country: true } },
        requestedBy: { select: { id: true, name: true, email: true } },
        icpLab: { select: { id: true, name: true, city: true, country: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, trials });
  } catch (e: any) {
    console.error("Sample trial list error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

/* ── POST /api/factory-portal/sample-trial ── create new trial request ── */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const isFactory = user.role === "FACTORY_USER" || user.role === "FACTORY_MANAGER";
    const isAdmin = user.role === "ADMIN" || user.role === "EMPLOYEE";

    if (!isFactory && !isAdmin) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const factoryId = user.factoryId;
    if (!factoryId && !isAdmin) {
      return NextResponse.json({ ok: false, error: "No factory linked to your account" }, { status: 400 });
    }

    const body = await req.json();
    const {
      fabricId,
      purposeType,
      brandId,
      partnershipNote,
      trialType,
      totalMeters,
      totalUnit,
      targetFuzeTier,
      applicationMethod,
      shippingAddress,
      shippingCity,
      shippingState,
      shippingPostalCode,
      shippingCountry,
      shippingContactName,
      shippingContactPhone,
      shippingContactEmail,
      shippingCarrier,
      shippingAccountNumber,
      shippingMethod,
      shippingNotes,
      icpLabId,
      icpLabOther,
      icpCommitDate,
      notes,
    } = body;

    // Validations
    if (!fabricId) return NextResponse.json({ ok: false, error: "Fabric is required" }, { status: 400 });
    if (!purposeType || !["BRAND_PARTNERSHIP", "SELF_DEVELOPMENT"].includes(purposeType)) {
      return NextResponse.json({ ok: false, error: "Purpose type must be BRAND_PARTNERSHIP or SELF_DEVELOPMENT" }, { status: 400 });
    }
    if (purposeType === "BRAND_PARTNERSHIP" && !brandId && !partnershipNote) {
      return NextResponse.json({ ok: false, error: "Select a brand or provide a partnership note" }, { status: 400 });
    }
    if (!trialType || !["LAB_TRIAL", "PRODUCTION_TRIAL"].includes(trialType)) {
      return NextResponse.json({ ok: false, error: "Trial type must be LAB_TRIAL or PRODUCTION_TRIAL" }, { status: 400 });
    }
    if (!totalMeters || totalMeters <= 0) {
      return NextResponse.json({ ok: false, error: "Total meters/yards must be greater than 0" }, { status: 400 });
    }
    if (!icpLabId && !icpLabOther) {
      return NextResponse.json({ ok: false, error: "ICP lab commitment is mandatory. Select a lab or provide lab details." }, { status: 400 });
    }
    // Shipping validation — factory pays freight on US-origin samples
    if (!shippingAddress || !shippingCity || !shippingCountry) {
      return NextResponse.json({ ok: false, error: "Shipping address, city, and country are required." }, { status: 400 });
    }
    if (!shippingContactName || !shippingContactPhone) {
      return NextResponse.json({ ok: false, error: "Shipping contact name and phone are required." }, { status: 400 });
    }
    if (!shippingCarrier || !shippingAccountNumber) {
      return NextResponse.json({ ok: false, error: "Freight carrier and account number are required. FUZE provides samples free — you provide the shipping account." }, { status: 400 });
    }

    // Verify fabric exists and belongs to factory
    const fabric = await prisma.fabric.findUnique({
      where: { id: fabricId },
      select: { id: true, factoryId: true, weightGsm: true, widthInches: true },
    });
    if (!fabric) return NextResponse.json({ ok: false, error: "Fabric not found" }, { status: 404 });
    if (!isAdmin && fabric.factoryId !== factoryId) {
      return NextResponse.json({ ok: false, error: "Fabric does not belong to your factory" }, { status: 403 });
    }

    // Calculate FUZE sample volume
    // volumeLiters = (weightGsm / 1000) × widthMeters × lengthMeters × (tierDose / stockConcentration)
    const tierDoses: Record<string, number> = { F1: 1.0, F2: 0.75, F3: 0.5, F4: 0.25 };
    const stockConcentration = 30; // 30 mg/L
    let sampleVolumeLiters: number | null = null;

    const lengthM = totalUnit === "yards" ? (totalMeters || 0) * 0.9144 : (totalMeters || 0);
    const widthM = fabric.widthInches ? fabric.widthInches * 0.0254 : 1.5; // default 1.5m
    const weightKg = (fabric.weightGsm || 200) / 1000; // default 200 gsm
    const dose = tierDoses[targetFuzeTier || "F2"] || 0.75;

    sampleVolumeLiters = Math.round(weightKg * widthM * lengthM * (dose / stockConcentration) * 100) / 100;

    // Use admin-provided factoryId if admin is creating on behalf
    const effectiveFactoryId = isAdmin && body.factoryId ? body.factoryId : factoryId;

    const trial = await prisma.sampleTrialRequest.create({
      data: {
        factoryId: effectiveFactoryId,
        requestedById: user.id,
        fabricId,
        purposeType,
        brandId: brandId || null,
        partnershipNote: partnershipNote || null,
        trialType,
        totalMeters: parseFloat(totalMeters),
        totalUnit: totalUnit || "meters",
        targetFuzeTier: targetFuzeTier || null,
        applicationMethod: applicationMethod || null,
        sampleVolumeLiters,
        shippingAddress: shippingAddress || null,
        shippingCity: shippingCity || null,
        shippingState: shippingState || null,
        shippingPostalCode: shippingPostalCode || null,
        shippingCountry: shippingCountry || null,
        shippingContactName: shippingContactName || null,
        shippingContactPhone: shippingContactPhone || null,
        shippingContactEmail: shippingContactEmail || null,
        shippingCarrier: shippingCarrier || null,
        shippingAccountNumber: shippingAccountNumber || null,
        shippingMethod: shippingMethod || "STANDARD",
        shippingNotes: shippingNotes || null,
        icpLabId: icpLabId || null,
        icpLabOther: icpLabOther || null,
        icpCommitDate: icpCommitDate ? new Date(icpCommitDate) : null,
        notes: notes || null,
        status: "SUBMITTED",
      },
      include: {
        fabric: { select: { fuzeNumber: true, customerCode: true } },
        brand: { select: { name: true } },
        icpLab: { select: { name: true, city: true, country: true } },
      },
    });

    return NextResponse.json({ ok: true, trial });
  } catch (e: any) {
    console.error("Sample trial create error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
