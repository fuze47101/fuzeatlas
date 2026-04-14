// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * Graduate a RecipeBenchTest into published FabricRecipe rows.
 *
 * POST /api/admin/recipe-bench-tests/[id]/graduate
 *   body: { tiers?: ["F1","F2","F3","F4"] }   (default: all four)
 *
 * One FabricRecipe is created per requested tier, sharing the bench
 * test's fabric spec, method, squeeze pressure, drying/curing, and
 * pickup, but with the tier-specific bath concentration from the
 * calculated row.
 */

const TIER_MG_PER_KG: Record<string, number> = { F1: 1.0, F2: 0.75, F3: 0.5, F4: 0.25 };

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user || !["ADMIN", "EMPLOYEE", "LAB_USER", "LAB_MANAGER"].includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    const test = await prisma.recipeBenchTest.findUnique({
      where: { id },
      include: { fabric: { select: { id: true, fuzeNumber: true, name: true } } },
    });
    if (!test) return NextResponse.json({ ok: false, error: "Bench test not found" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const tiers: string[] = Array.isArray(body.tiers) && body.tiers.length > 0
      ? body.tiers.filter((t: string) => TIER_MG_PER_KG[t])
      : ["F1", "F2", "F3", "F4"];

    const pickup = test.pickupWetToWetPct || test.pickupDryToWetPct || null;
    const baseName = test.fabric?.fuzeNumber
      ? `${test.fabric.fuzeNumber} · ${test.fabricLabel}`
      : test.fabricLabel;

    const created = [];
    for (const tier of tiers) {
      const bathKey = `${tier.toLowerCase()}BathMgPerL` as const;
      const bathConc = (test as any)[bathKey] || null;
      const recipeName = `${baseName} · ${test.applicationMethod.replace(/_/g, "-")} · ${tier}`;

      const recipe = await prisma.fabricRecipe.create({
        data: {
          name: recipeName,
          fabricType: test.fabricType || null,
          fiberContent: test.fiberContent || null,
          gsmMin: test.fabricWeightGsm ? Math.max(0, test.fabricWeightGsm - 20) : null,
          gsmMax: test.fabricWeightGsm ? test.fabricWeightGsm + 20 : null,
          yarnType: null,
          fuzeTier: tier,
          applicationMethod: test.applicationMethod === "PAD_DRY_CURE" ? "Pad"
            : test.applicationMethod === "EXHAUST" ? "Exhaust"
            : test.applicationMethod === "SPRAY" ? "Spray"
            : test.applicationMethod === "FOAM" ? "Foam"
            : test.applicationMethod,
          padPickupPercent: pickup,
          bathConcentration: bathConc,
          squeezePressure: test.squeezePressure,
          dryingTemp: test.dryingTemp,
          dryingTime: test.dryingTime,
          curingTemp: test.curingTemp,
          curingTime: test.curingTime,
          notes: [
            `Graduated from bench test ${test.testNumber}`,
            test.notes,
          ].filter(Boolean).join(" — "),
          active: true,
          createdById: user.id,
        },
      });
      created.push(recipe);
    }

    // Record the first recipe as the primary graduated reference
    await prisma.recipeBenchTest.update({
      where: { id },
      data: { graduatedRecipeId: created[0]?.id || null },
    });

    return NextResponse.json({
      ok: true,
      recipes: created,
      message: `Graduated ${created.length} recipe${created.length > 1 ? "s" : ""} from ${test.testNumber}`,
    });
  } catch (e: any) {
    console.error("Graduate error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
