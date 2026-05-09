// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { notifyRecipeMilestone } from "@/lib/notify-recipe";

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
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const allowed = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP", "LAB_USER", "LAB_MANAGER"];
    if (!allowed.includes(user.role)) {
      return NextResponse.json({ ok: false, error: `Role ${user.role} not permitted` }, { status: 403 });
    }

    const test = await prisma.recipeBenchTest.findUnique({
      where: { id },
      include: { fabric: { select: { id: true, fuzeNumber: true } } },
    });
    if (!test) return NextResponse.json({ ok: false, error: "Bench test not found" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const tiers: string[] = Array.isArray(body.tiers) && body.tiers.length > 0
      ? body.tiers.filter((t: string) => TIER_MG_PER_KG[t])
      : ["F1", "F2", "F3", "F4"];

    const safeNum = (v: any): number | null => {
      if (v === null || v === undefined) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const pickup = safeNum(test.pickupWetToWetPct) ?? safeNum(test.pickupDryToWetPct);
    const gsm = safeNum(test.fabricWeightGsm);
    const baseName = test.fabric?.fuzeNumber
      ? `${test.fabric.fuzeNumber} · ${test.fabricLabel || "Fabric"}`
      : (test.fabricLabel || `Bench ${test.testNumber}`);
    const methodRaw: string = test.applicationMethod || "PAD_DRY_CURE";
    const methodPretty = methodRaw === "PAD_DRY_CURE" ? "Pad"
      : methodRaw === "EXHAUST" ? "Exhaust"
      : methodRaw === "SPRAY" ? "Spray"
      : methodRaw === "FOAM" ? "Foam"
      : methodRaw;

    const created = [];
    for (const tier of tiers) {
      const bathKey = `${tier.toLowerCase()}BathMgPerL` as const;
      const bathConc = safeNum((test as any)[bathKey]);
      const recipeName = `${baseName} · ${methodPretty} · ${tier}`;

      try {
        const recipe = await prisma.fabricRecipe.create({
          data: {
            name: recipeName,
            fabricType: test.fabricType || null,
            fiberContent: test.fiberContent || null,
            gsmMin: gsm != null ? Math.max(0, gsm - 20) : null,
            gsmMax: gsm != null ? gsm + 20 : null,
            yarnType: null,
            fuzeTier: tier,
            applicationMethod: methodPretty,
            padPickupPercent: pickup,
            bathConcentration: bathConc,
            squeezePressure: safeNum(test.squeezePressure),
            dryingTemp: safeNum(test.dryingTemp),
            dryingTime: safeNum(test.dryingTime),
            curingTemp: safeNum(test.curingTemp),
            curingTime: safeNum(test.curingTime),
            notes: [
              `Graduated from bench test ${test.testNumber}`,
              test.notes,
            ].filter(Boolean).join(" — "),
            active: true,
            createdById: user.id || null,
          },
        });
        created.push(recipe);
      } catch (innerErr: any) {
        console.error(`Graduate failed at tier ${tier}:`, innerErr);
        return NextResponse.json({
          ok: false,
          error: `Tier ${tier} failed: ${innerErr?.message || String(innerErr)}`,
          createdSoFar: created.length,
        }, { status: 500 });
      }
    }

    // Record the first recipe as the primary graduated reference
    await prisma.recipeBenchTest.update({
      where: { id },
      data: { graduatedRecipeId: created[0]?.id || null },
    });

    // Penfabric/Raihana fix May 2026 — auto-notify the factory now that
    // the recipe is graduated. Generates a 90-day FabricReportShare per
    // factory user, emails them a tokenized link to /report/[token],
    // writes an in-app Notification. Failure is non-fatal: graduation
    // succeeds even if the notification fan-out errors.
    let notify = null;
    try {
      notify = await notifyRecipeMilestone(id, "RECIPE_GRADUATED", user.id || null);
    } catch (notifyErr) {
      console.error("[graduate] notifyRecipeMilestone threw:", notifyErr);
    }

    return NextResponse.json({
      ok: true,
      recipes: created,
      notify,
      message: `Graduated ${created.length} recipe${created.length > 1 ? "s" : ""} from ${test.testNumber}${
        notify?.ok ? ` · notified ${notify.emailedCount} factory user${notify.emailedCount === 1 ? "" : "s"}` : ""
      }`,
    });
  } catch (e: any) {
    console.error("Graduate error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
