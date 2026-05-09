// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Test-cadence cron — KUIU promise (Andrew → Joseph, May 7 2026):
 * "the site will also keep running track of ongoing ICP testing at
 * intervals of production batches that you stipulate in the setup."
 *
 * For every brand that has stipulated ICP cadence (Brand
 * .icpCadenceEveryNBatches OR .icpCadenceEveryLitersConsumed), walk
 * every factory currently producing FUZE-treated fabrics for that
 * brand. For each (brand, factory) pair:
 *
 *   1. Find the most-recent ICP test (TestRun with testType='ICP'
 *      AND brandVisible=true, scoped to submissions for this
 *      brand+factory).
 *   2. Count FuzeOrder rows for this brand+factory since that ICP
 *      (or all of them if no ICP exists yet).
 *   3. Sum FuzeConsumption.litersUsed for this brand+factory since
 *      the same cutoff.
 *   4. If batch count exceeds icpCadenceEveryNBatches, flag overdue.
 *      If liters consumed exceeds icpCadenceEveryLitersConsumed,
 *      same. Either threshold is enough — they're alternative
 *      cadence styles, not AND-conditions.
 *
 * Posts a Notification fan-out to every active brand user + admins
 * for each overdue pair. Idempotent-ish: stamps notification
 * metadata.cadenceFlagDate so we can suppress repeats inside 24h
 * (the cron runs daily; we don't want to ping the same brand every
 * morning until the factory finally tests).
 *
 * Schedule: 14:00 UTC daily — same window as feedback-digest, after
 * the lab usually returns overnight ICP results.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface OverdueRow {
  brandId: string;
  brandName: string;
  factoryId: string;
  factoryName: string;
  cadenceType: "batches" | "liters" | "both";
  ordersSinceIcp: number;
  litersSinceIcp: number;
  cadenceBatches?: number | null;
  cadenceLiters?: number | null;
  lastIcpAt: string | null;
}

export async function GET(req: Request) {
  // Vercel cron sends an Authorization: Bearer $CRON_SECRET header.
  // Middleware exempts /api/cron/*, so we re-verify here.
  const auth = req.headers.get("authorization") || "";
  const expected = process.env.CRON_SECRET;
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Brands with cadence stipulated
    const brands = await prisma.brand.findMany({
      where: {
        OR: [
          { icpCadenceEveryNBatches: { gt: 0 } },
          { icpCadenceEveryLitersConsumed: { gt: 0 } },
        ],
      },
      select: {
        id: true,
        name: true,
        icpCadenceEveryNBatches: true,
        icpCadenceEveryLitersConsumed: true,
      },
    });

    const overdueRows: OverdueRow[] = [];
    let factoriesChecked = 0;

    for (const brand of brands) {
      // 2. Factories in this brand's supply chain
      const factories = await prisma.factory.findMany({
        where: { fabrics: { some: { brandId: brand.id } } },
        select: { id: true, name: true },
      });

      for (const factory of factories) {
        factoriesChecked++;

        const lastIcp = await prisma.testRun.findFirst({
          where: {
            testType: "ICP",
            brandVisible: true,
            submission: { brandId: brand.id, factoryId: factory.id },
          },
          orderBy: [{ testDate: "desc" }, { createdAt: "desc" }],
          select: { testDate: true, createdAt: true },
        });

        const cutoff = lastIcp?.testDate || lastIcp?.createdAt || new Date(0);

        const [ordersSince, consumptionSince] = await Promise.all([
          prisma.fuzeOrder.count({
            where: {
              brandId: brand.id,
              factoryId: factory.id,
              createdAt: { gt: cutoff },
              status: { notIn: ["DRAFT", "CANCELLED"] },
            },
          }),
          prisma.fuzeConsumption.aggregate({
            where: {
              brandId: brand.id,
              factoryId: factory.id,
              usageDate: { gt: cutoff },
            },
            _sum: { litersUsed: true },
          }),
        ]);

        const litersSince = consumptionSince._sum.litersUsed || 0;
        const overByBatches =
          brand.icpCadenceEveryNBatches != null &&
          brand.icpCadenceEveryNBatches > 0 &&
          ordersSince >= brand.icpCadenceEveryNBatches;
        const overByLiters =
          brand.icpCadenceEveryLitersConsumed != null &&
          brand.icpCadenceEveryLitersConsumed > 0 &&
          litersSince >= brand.icpCadenceEveryLitersConsumed;

        if (overByBatches || overByLiters) {
          overdueRows.push({
            brandId: brand.id,
            brandName: brand.name,
            factoryId: factory.id,
            factoryName: factory.name,
            cadenceType: overByBatches && overByLiters ? "both" : overByBatches ? "batches" : "liters",
            ordersSinceIcp: ordersSince,
            litersSinceIcp: litersSince,
            cadenceBatches: brand.icpCadenceEveryNBatches,
            cadenceLiters: brand.icpCadenceEveryLitersConsumed,
            lastIcpAt: lastIcp?.testDate?.toISOString() || lastIcp?.createdAt?.toISOString() || null,
          });
        }
      }
    }

    // 3. Fan out notifications. Suppress repeat notifications inside
    // 24h by checking metadata.kind='cadence_overdue' on existing rows.
    const since = new Date(Date.now() - 22 * 60 * 60 * 1000);
    let notificationsCreated = 0;
    for (const row of overdueRows) {
      const existing = await prisma.notification.findFirst({
        where: {
          createdAt: { gte: since },
          AND: [
            { metadata: { path: ["kind"], equals: "cadence_overdue" } },
            { metadata: { path: ["brandId"], equals: row.brandId } },
            { metadata: { path: ["factoryId"], equals: row.factoryId } },
          ],
        },
        select: { id: true },
      });
      if (existing) continue;

      const brandUsers = await prisma.user.findMany({
        where: { brandId: row.brandId, status: "ACTIVE" },
        select: { id: true },
      });
      const adminUsers = await prisma.user.findMany({
        where: { role: "ADMIN", status: "ACTIVE" },
        select: { id: true },
      });
      const recipientIds = new Set<string>([
        ...brandUsers.map((u: any) => u.id),
        ...adminUsers.map((u: any) => u.id),
      ]);

      const detailParts: string[] = [];
      if (row.cadenceType === "batches" || row.cadenceType === "both") {
        detailParts.push(`${row.ordersSinceIcp} order${row.ordersSinceIcp === 1 ? "" : "s"} since last ICP (cadence: every ${row.cadenceBatches})`);
      }
      if (row.cadenceType === "liters" || row.cadenceType === "both") {
        detailParts.push(`${row.litersSinceIcp.toFixed(0)} L consumed since last ICP (cadence: every ${row.cadenceLiters} L)`);
      }

      const message = `${row.factoryName} is overdue for an ICP submission for ${row.brandName}. ${detailParts.join("; ")}.`;

      await prisma.notification.createMany({
        data: Array.from(recipientIds).map((userId) => ({
          userId,
          type: "TEST_RESULTS",
          title: `🧪 ICP cadence overdue: ${row.factoryName}`,
          message,
          link: `/brand-portal/supply-chain`,
          metadata: {
            kind: "cadence_overdue",
            brandId: row.brandId,
            factoryId: row.factoryId,
            ordersSinceIcp: row.ordersSinceIcp,
            litersSinceIcp: row.litersSinceIcp,
            cadenceBatches: row.cadenceBatches,
            cadenceLiters: row.cadenceLiters,
            lastIcpAt: row.lastIcpAt,
          },
        })),
      });
      notificationsCreated += recipientIds.size;
    }

    return NextResponse.json({
      ok: true,
      brandsChecked: brands.length,
      factoriesChecked,
      overdueCount: overdueRows.length,
      notificationsCreated,
      overdue: overdueRows,
    });
  } catch (e: any) {
    console.error("[cron/test-cadence] error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 500 });
  }
}
