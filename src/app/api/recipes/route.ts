// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* ── GET /api/recipes ── list recipes with filters and matching ────────── */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const fabricType = url.searchParams.get("fabricType");
    const fuzeTier = url.searchParams.get("fuzeTier");
    const applicationMethod = url.searchParams.get("applicationMethod");
    const matchGsm = url.searchParams.get("matchGsm");
    const matchFiber = url.searchParams.get("matchFiber");
    const matchYarn = url.searchParams.get("matchYarn");

    const where: any = { active: true };

    if (fabricType) where.fabricType = fabricType;
    if (fuzeTier) where.fuzeTier = fuzeTier;
    if (applicationMethod) where.applicationMethod = applicationMethod;

    let recipes = await prisma.fabricRecipe.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    // If match params provided, score and sort recipes
    if (matchGsm || matchFiber || matchYarn) {
      const gsmNum = matchGsm ? parseFloat(matchGsm) : null;

      recipes = recipes
        .map((recipe) => {
          let score = 0;

          // GSM match (within range)
          if (gsmNum && recipe.gsmMin && recipe.gsmMax) {
            if (gsmNum >= recipe.gsmMin && gsmNum <= recipe.gsmMax) {
              score += 30;
            }
          }

          // Fiber content match
          if (matchFiber && recipe.fiberContent) {
            if (recipe.fiberContent.toLowerCase().includes(matchFiber.toLowerCase())) {
              score += 35;
            }
          }

          // Yarn type match
          if (matchYarn && recipe.yarnType) {
            if (recipe.yarnType.toLowerCase().includes(matchYarn.toLowerCase())) {
              score += 35;
            }
          }

          return { ...recipe, matchScore: score };
        })
        .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
    }

    return NextResponse.json({
      ok: true,
      recipes,
    });
  } catch (error) {
    console.error("Error fetching recipes:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch recipes" },
      { status: 500 }
    );
  }
}

/* ── POST /api/recipes ── create recipe ────────── */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, fabricType, fiberContent, gsmMin, gsmMax, yarnType,
      fuzeTier, applicationMethod, padPickupPercent, bathConcentration,
      squeezePressure, dryingTemp, dryingTime, curingTemp, curingTime, phRange,
      avgIcpAg, avgReduction, testMethod, passRate, validatedTestCount,
      notes, active, createdById } = body;

    const recipe = await prisma.fabricRecipe.create({
      data: {
        name, fabricType, fiberContent, gsmMin, gsmMax, yarnType,
        fuzeTier, applicationMethod, padPickupPercent, bathConcentration,
        squeezePressure, dryingTemp, dryingTime, curingTemp, curingTime, phRange,
        avgIcpAg, avgReduction, testMethod, passRate, validatedTestCount,
        notes, active, createdById,
      },
    });

    return NextResponse.json({ ok: true, recipe });
  } catch (error) {
    console.error("Error creating recipe:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to create recipe" },
      { status: 500 }
    );
  }
}
