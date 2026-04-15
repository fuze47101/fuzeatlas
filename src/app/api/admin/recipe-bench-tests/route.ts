// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * Recipe Bench Tests — lab measurement + auto-calculation endpoint.
 *
 * GET  /api/admin/recipe-bench-tests — list tests (recent first)
 * POST /api/admin/recipe-bench-tests — save a new bench test entry
 */

const STOCK_MG_PER_L = 30;           // FUZE stock concentration
const TIER_MG_PER_KG = { F1: 1.0, F2: 0.75, F3: 0.5, F4: 0.25 };

function generateTestNumber() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `FUZE-BT-${ymd}-${rand}`;
}

/**
 * Pure calculation so the UI can preview before saving, and the
 * server can recompute canonical values on save.
 */
function computeRecipe(input: any) {
  const dry = Number(input.drySampleWeight) || 0;
  const wetDryToWet = Number(input.wetAfterBathWeight) || 0;
  const preWet = Number(input.preWetSampleWeight) || 0;
  const wetFromPreWet = Number(input.wetAfterBathFromPreWet) || 0;
  const stock = Number(input.stockMgPerL) || STOCK_MG_PER_L;

  const out: any = { stockMgPerL: stock };

  // Pickup % dry-to-wet
  if (dry > 0 && wetDryToWet > 0) {
    out.pickupDryToWetPct = ((wetDryToWet - dry) / dry) * 100;
  }

  // Pickup % wet-to-wet (measures incremental bath pickup only)
  if (dry > 0 && preWet > 0 && wetFromPreWet > 0) {
    out.preWetMoisturePct = ((preWet - dry) / dry) * 100;
    // Net bath pickup = additional wet mass on top of pre-wet sample
    out.pickupWetToWetPct = ((wetFromPreWet - preWet) / dry) * 100;
  }

  // Pick which pickup to use for each tier's bath recipe.
  // If wet-to-wet is provided, prefer it; otherwise use dry-to-wet.
  const pickup = out.pickupWetToWetPct || out.pickupDryToWetPct;

  for (const [tier, mgPerKg] of Object.entries(TIER_MG_PER_KG)) {
    if (!pickup || pickup <= 0) continue;
    // Target: tier mg of active per kg of fabric
    // Bath concentration needed = mgPerKg / (pickup/100) × (1 kg fabric / 1 L bath implied)
    // Actually proper math:
    //   active_per_kg_fabric (mg) = bath_conc (mg/L) × pickup_liters_per_kg (L/kg)
    //   pickup_liters_per_kg = pickup% / 100 × (1 / fabric_density_in_bath)
    //   simplified: if pickup% is mass basis (g bath / g dry fabric × 100),
    //   and 1 L of bath ≈ 1 kg bath (water), then:
    //     pickup_kg_bath_per_kg_fabric = pickup/100
    //     bath_conc = mgPerKg / (pickup/100)  →  mg per L (since 1L water ≈ 1kg)
    const bathMgPerL = mgPerKg / (pickup / 100);
    const fuzeMlPerLBath = (bathMgPerL / stock) * 1000; // mL FUZE per L final bath
    // Dilution ratio: "1 part FUZE : N parts water"
    // Assuming additive volumes (fine for dilute): ratio = (stock/bathConc) - 1
    const dilutionRatio = stock / bathMgPerL - 1;

    out[`${tier.toLowerCase()}BathMgPerL`] = bathMgPerL;
    out[`${tier.toLowerCase()}FuzeMlPerLBath`] = fuzeMlPerLBath;
    out[`${tier.toLowerCase()}DilutionRatio`] = dilutionRatio;
  }

  // Production scaling
  const targetKg = Number(input.targetProductionKg) || 0;
  if (targetKg > 0 && pickup) {
    // Total bath volume = fabric mass × pickup fraction (for pad), assuming 1L bath picks up pickup% of its weight per kg fabric.
    // For pad: bath consumption per kg fabric ≈ pickup/100 L/kg (same density assumption)
    const bathPerKg = pickup / 100;
    out.targetBathVolumeL = targetKg * bathPerKg;

    for (const tier of Object.keys(TIER_MG_PER_KG)) {
      // FUZE liters = (fabric mass × mgPerKg) / stockMgPerL / 1000 (convert mg to g)
      // Actually: (kg × mg/kg) = mg needed → divide by mg/L = L
      const fuzeLiters = (targetKg * TIER_MG_PER_KG[tier as "F1"]) / stock;
      out[`${tier.toLowerCase()}FuzeLitersForTarget`] = fuzeLiters;
    }
  }

  return out;
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const allowed = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "LAB_USER", "LAB_MANAGER"];
    if (!allowed.includes(user.role)) {
      return NextResponse.json({ ok: false, error: `Role ${user.role} not permitted` }, { status: 403 });
    }
    const tests = await prisma.recipeBenchTest.findMany({
      orderBy: { testDate: "desc" },
      include: { fabric: { select: { id: true, fuzeNumber: true, name: true } } },
      take: 200,
    });
    return NextResponse.json({ ok: true, tests });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const allowed = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "LAB_USER", "LAB_MANAGER"];
    if (!allowed.includes(user.role)) {
      return NextResponse.json({ ok: false, error: `Role ${user.role} not permitted` }, { status: 403 });
    }
    const body = await req.json();

    if (!body.drySampleWeight || !body.wetAfterBathWeight) {
      return NextResponse.json({
        ok: false,
        error: "Dry sample weight and wet-after-bath weight are required.",
      }, { status: 400 });
    }

    const calc = computeRecipe(body);

    const test = await prisma.recipeBenchTest.create({
      data: {
        testNumber: body.testNumber || generateTestNumber(),
        testDate: body.testDate ? new Date(body.testDate) : new Date(),

        fabricId: body.fabricId || null,
        fabricLabel: body.fabricLabel || body.fabricName || "Unnamed fabric",
        fabricType: body.fabricType || null,
        fiberContent: body.fiberContent || null,
        fabricWeightGsm: body.fabricWeightGsm ? Number(body.fabricWeightGsm) : null,

        applicationMethod: body.applicationMethod || "PAD_DRY_CURE",
        squeezePressure: body.squeezePressure ? Number(body.squeezePressure) : null,
        vfdFrequencyHz: body.vfdFrequencyHz ? Number(body.vfdFrequencyHz) : null,
        lineSpeedMPerMin: body.vfdFrequencyHz ? Number(body.vfdFrequencyHz) * 0.295 : null,
        dryingTemp: body.dryingTemp ? Number(body.dryingTemp) : null,
        dryingTime: body.dryingTime ? Number(body.dryingTime) : null,
        curingTemp: body.curingTemp ? Number(body.curingTemp) : null,
        curingTime: body.curingTime ? Number(body.curingTime) : null,
        liquorRatio: body.liquorRatio || null,

        sampleAreaCm2: body.sampleAreaCm2 ? Number(body.sampleAreaCm2) : 100,
        sampleRuns: body.sampleRuns || null,
        drySampleWeight: Number(body.drySampleWeight),
        wetAfterBathWeight: Number(body.wetAfterBathWeight),
        preWetSampleWeight: body.preWetSampleWeight ? Number(body.preWetSampleWeight) : null,
        wetAfterBathFromPreWet: body.wetAfterBathFromPreWet ? Number(body.wetAfterBathFromPreWet) : null,

        pickupDryToWetPct: calc.pickupDryToWetPct ?? null,
        pickupWetToWetPct: calc.pickupWetToWetPct ?? null,
        preWetMoisturePct: calc.preWetMoisturePct ?? null,

        f1BathMgPerL: calc.f1BathMgPerL ?? null,
        f2BathMgPerL: calc.f2BathMgPerL ?? null,
        f3BathMgPerL: calc.f3BathMgPerL ?? null,
        f4BathMgPerL: calc.f4BathMgPerL ?? null,
        f1DilutionRatio: calc.f1DilutionRatio ?? null,
        f2DilutionRatio: calc.f2DilutionRatio ?? null,
        f3DilutionRatio: calc.f3DilutionRatio ?? null,
        f4DilutionRatio: calc.f4DilutionRatio ?? null,
        f1FuzeMlPerLBath: calc.f1FuzeMlPerLBath ?? null,
        f2FuzeMlPerLBath: calc.f2FuzeMlPerLBath ?? null,
        f3FuzeMlPerLBath: calc.f3FuzeMlPerLBath ?? null,
        f4FuzeMlPerLBath: calc.f4FuzeMlPerLBath ?? null,

        targetProductionKg: body.targetProductionKg ? Number(body.targetProductionKg) : null,
        targetBathVolumeL: calc.targetBathVolumeL ?? null,
        f1FuzeLitersForTarget: calc.f1FuzeLitersForTarget ?? null,
        f2FuzeLitersForTarget: calc.f2FuzeLitersForTarget ?? null,
        f3FuzeLitersForTarget: calc.f3FuzeLitersForTarget ?? null,
        f4FuzeLitersForTarget: calc.f4FuzeLitersForTarget ?? null,

        stockMgPerL: Number(body.stockMgPerL) || STOCK_MG_PER_L,

        // Test bath + ICP expected
        testedAtTier: body.testedAtTier || null,
        testBathVolumeL: body.testBathVolumeL ? Number(body.testBathVolumeL) : null,
        testBathFuzeMl: body.testBathFuzeMl ?? null,
        testBathWaterMl: body.testBathWaterMl ?? null,
        icpExpectedPpm: body.icpExpectedPpm ?? null,

        qcPassed: body.qcPassed !== false,
        notes: body.notes || null,
        createdById: user.id,
      },
    });

    return NextResponse.json({ ok: true, test, calc });
  } catch (e: any) {
    console.error("Recipe bench test POST error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
