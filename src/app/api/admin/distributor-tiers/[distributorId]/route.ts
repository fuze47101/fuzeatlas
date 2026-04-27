// @ts-nocheck
/**
 * GET  /api/admin/distributor-tiers/[distributorId]
 *   Returns the up-to-5 tier rows for this distributor, plus the
 *   default pricing row if any (kept for legacy single-tier shape).
 *
 * PUT  /api/admin/distributor-tiers/[distributorId]
 *   Bulk-replaces the 5 tier rows in one transaction. Body:
 *     { tiers: [
 *         { tierIndex: 1, tierName: "Tier 1", pricePerLiter: 38.5,
 *           currency: "USD", minOrderLiters: 19, leadTimeDays: 14,
 *           hangtagPricePerUnit: 0.15, notes: "..." },
 *         ... up to 5 ...
 *       ] }
 *   Rows with tierIndex 1..5 replace existing tier rows. The legacy
 *   isDefault row is left alone — it's still the fallback when a
 *   factory has no tier assigned.
 *
 * Why bulk-replace instead of per-row edits: the 5-tier table is
 * structurally a single object the distributor edits as a whole. A
 * per-row save dance would mean partial updates that confuse the
 * downstream pricing resolver (which assumes the table is consistent).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ distributorId: string }> },
) {
  try {
    const { distributorId } = await params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const isInternal = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"].includes(
      user.role,
    );
    const isThisDist =
      user.role === "DISTRIBUTOR_USER" && user.distributorId === distributorId;
    if (!isInternal && !isThisDist) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const [distributor, allRows, factories] = await Promise.all([
      prisma.distributor.findUnique({
        where: { id: distributorId },
        select: {
          id: true,
          name: true,
          localCurrency: true,
          parentDistributorId: true,
          parentDistributor: { select: { id: true, name: true, localCurrency: true } },
          subDistributors: {
            select: { id: true, name: true, country: true, localCurrency: true },
            orderBy: { name: "asc" },
          },
        },
      }),
      prisma.distributorPricing.findMany({
        where: { distributorId, active: true },
        orderBy: [{ tierIndex: "asc" }, { createdAt: "desc" }],
      }),
      prisma.factory.findMany({
        where: { distributorId },
        select: {
          id: true,
          name: true,
          country: true,
          distributorTierIndex: true,
        },
        orderBy: { name: "asc" },
      }),
    ]);

    if (!distributor) {
      return NextResponse.json(
        { ok: false, error: "Distributor not found" },
        { status: 404 },
      );
    }

    // Bucket rows: tierIndex 1..5 + default + other
    const tiers = [1, 2, 3, 4, 5].map((idx) => {
      const row = allRows.find((r: any) => r.tierIndex === idx) || null;
      return {
        tierIndex: idx,
        tierName: row?.tierName || `Tier ${idx}`,
        pricePerLiter: row?.pricePerLiter ?? null,
        currency: row?.currency || distributor.localCurrency || "USD",
        minOrderLiters: row?.minOrderLiters ?? null,
        leadTimeDays: row?.leadTimeDays ?? null,
        hangtagPricePerUnit: row?.hangtagPricePerUnit ?? null,
        hangtagMinOrder: row?.hangtagMinOrder ?? null,
        notes: row?.notes ?? null,
        rowId: row?.id ?? null, // null if not yet created
      };
    });

    // Factory assignment counts per tier
    const tierFactoryCounts = factories.reduce((acc: any, f: any) => {
      const k = f.distributorTierIndex;
      if (k != null) acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});

    const defaultRow =
      allRows.find((r: any) => r.isDefault) ||
      allRows.find((r: any) => r.tierIndex == null) ||
      null;

    return NextResponse.json({
      ok: true,
      distributor,
      tiers,
      defaultRow,
      factories,
      tierFactoryCounts,
    });
  } catch (e: any) {
    console.error("[distributor-tiers.GET] error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ distributorId: string }> },
) {
  try {
    const { distributorId } = await params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const isInternal = ["ADMIN", "EMPLOYEE"].includes(user.role);
    const isThisDist =
      user.role === "DISTRIBUTOR_USER" && user.distributorId === distributorId;
    if (!isInternal && !isThisDist) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const incoming: any[] = Array.isArray(body.tiers) ? body.tiers : [];
    if (incoming.length === 0) {
      return NextResponse.json(
        { ok: false, error: "tiers array required" },
        { status: 400 },
      );
    }

    // Build the per-tier upsert plan. We only touch tiers 1..5; legacy
    // default rows are untouched so price lookup keeps falling back
    // cleanly.
    await prisma.$transaction(async (tx: any) => {
      for (const t of incoming) {
        const idx = Number(t.tierIndex);
        if (!Number.isInteger(idx) || idx < 1 || idx > 5) continue;

        // null/empty price means the tier is not configured — clear
        // any existing row at this index by setting active=false.
        const priceRaw = t.pricePerLiter;
        const priceNull =
          priceRaw === "" || priceRaw === null || priceRaw === undefined;

        const existing = await tx.distributorPricing.findFirst({
          where: { distributorId, tierIndex: idx, active: true },
          orderBy: { createdAt: "desc" },
        });

        if (priceNull) {
          // Tier cleared — soft-delete the row if it exists.
          if (existing) {
            await tx.distributorPricing.update({
              where: { id: existing.id },
              data: { active: false },
            });
          }
          continue;
        }

        const data: any = {
          distributorId,
          tierIndex: idx,
          tierName: t.tierName || `Tier ${idx}`,
          pricePerLiter: Number(priceRaw),
          currency: t.currency || "USD",
          minOrderLiters:
            t.minOrderLiters != null && t.minOrderLiters !== ""
              ? Number(t.minOrderLiters)
              : null,
          leadTimeDays:
            t.leadTimeDays != null && t.leadTimeDays !== ""
              ? Number(t.leadTimeDays)
              : null,
          hangtagPricePerUnit:
            t.hangtagPricePerUnit != null && t.hangtagPricePerUnit !== ""
              ? Number(t.hangtagPricePerUnit)
              : null,
          hangtagMinOrder:
            t.hangtagMinOrder != null && t.hangtagMinOrder !== ""
              ? Number(t.hangtagMinOrder)
              : null,
          notes: t.notes || null,
          active: true,
        };

        if (existing) {
          await tx.distributorPricing.update({
            where: { id: existing.id },
            data,
          });
        } else {
          await tx.distributorPricing.create({ data });
        }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[distributor-tiers.PUT] error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
