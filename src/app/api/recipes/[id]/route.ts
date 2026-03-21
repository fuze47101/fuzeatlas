// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* ── GET /api/recipes/[id] ── get recipe details ────────── */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const recipe = await prisma.fabricRecipe.findUnique({
      where: { id },
    });

    if (!recipe) {
      return NextResponse.json({ ok: false, error: "Recipe not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, recipe });
  } catch (error) {
    console.error("Error fetching recipe:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch recipe" },
      { status: 500 }
    );
  }
}

/* ── PUT /api/recipes/[id] ── update recipe ────────── */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, fabricType, fiberContent, gsmMin, gsmMax, yarnType,
      fuzeTier, applicationMethod, padPickupPercent, bathConcentration,
      squeezePressure, dryingTemp, dryingTime, curingTemp, curingTime, phRange,
      avgIcpAg, avgReduction, testMethod, passRate, validatedTestCount,
      notes, active, createdById } = body;

    const recipe = await prisma.fabricRecipe.update({
      where: { id },
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
    console.error("Error updating recipe:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to update recipe" },
      { status: 500 }
    );
  }
}

/* ── DELETE /api/recipes/[id] ── delete recipe ────────── */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.fabricRecipe.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting recipe:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to delete recipe" },
      { status: 500 }
    );
  }
}
