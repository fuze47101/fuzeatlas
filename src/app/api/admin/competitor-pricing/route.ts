// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasMinRole } from "@/lib/auth";

// GET — list all overrides
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
    }

    const overrides = await prisma.competitorPriceOverride.findMany({
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ ok: true, overrides });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// POST — create or update (upsert by competitorId)
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasMinRole(user.role, "ADMIN")) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
      competitorId,
      chemicalPricePerKg,
      chemicalPriceSource,
      chemicalPriceDate,
      binderPricePerKg,
      estimatedCostPerMeterLow,
      estimatedCostPerMeterHigh,
      estimatedCostPerMeterTypical,
      retreatmentCostMultiplier,
      notes,
    } = body;

    if (!competitorId) {
      return NextResponse.json({ ok: false, error: "competitorId is required" }, { status: 400 });
    }

    const data = {
      chemicalPricePerKg: chemicalPricePerKg != null ? Number(chemicalPricePerKg) : null,
      chemicalPriceSource: chemicalPriceSource || null,
      chemicalPriceDate: chemicalPriceDate ? new Date(chemicalPriceDate) : null,
      binderPricePerKg: binderPricePerKg != null ? Number(binderPricePerKg) : null,
      estimatedCostPerMeterLow: estimatedCostPerMeterLow != null ? Number(estimatedCostPerMeterLow) : null,
      estimatedCostPerMeterHigh: estimatedCostPerMeterHigh != null ? Number(estimatedCostPerMeterHigh) : null,
      estimatedCostPerMeterTypical: estimatedCostPerMeterTypical != null ? Number(estimatedCostPerMeterTypical) : null,
      retreatmentCostMultiplier: retreatmentCostMultiplier != null ? Number(retreatmentCostMultiplier) : null,
      notes: notes || null,
      updatedBy: user.name || user.email,
    };

    const override = await prisma.competitorPriceOverride.upsert({
      where: { competitorId },
      create: { competitorId, ...data },
      update: data,
    });

    return NextResponse.json({ ok: true, override });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// DELETE — remove override for a competitor
export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasMinRole(user.role, "ADMIN")) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const competitorId = searchParams.get("competitorId");

    if (!competitorId) {
      return NextResponse.json({ ok: false, error: "competitorId is required" }, { status: 400 });
    }

    await prisma.competitorPriceOverride.deleteMany({
      where: { competitorId },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
