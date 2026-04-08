// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/admin/conversion-tracking
 * Tracks sample → production conversion rates.
 * Shows which factories/brands received samples and whether they converted to production orders.
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const isInternal = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"].includes(user.role);
    if (!isInternal) {
      return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    // ─── 1. Get all sample orders ───
    const sampleOrders = await prisma.fuzeOrder.findMany({
      where: { orderType: "SAMPLE" },
      include: {
        factory: { select: { id: true, name: true, country: true } },
        brand: { select: { id: true, name: true } },
        brandAllocations: { include: { brand: { select: { id: true, name: true } } } },
        accountManager: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // ─── 2. Get all production orders ───
    const productionOrders = await prisma.fuzeOrder.findMany({
      where: { orderType: "PRODUCTION" },
      select: {
        factoryId: true,
        brandId: true,
        volumeLiters: true,
        totalPrice: true,
        status: true,
        createdAt: true,
        brandAllocations: { select: { brandId: true } },
      },
    });

    // ─── 3. Also get sample trial requests ───
    const trials = await prisma.sampleTrialRequest.findMany({
      where: { status: { in: ["SAMPLE_SHIPPED", "SAMPLE_RECEIVED", "TRIAL_IN_PROGRESS", "COMPLETE"] } },
      select: {
        id: true,
        factoryId: true,
        factory: { select: { id: true, name: true, country: true } },
        brandId: true,
        brand: { select: { id: true, name: true } },
        sampleVolumeLiters: true,
        status: true,
        createdAt: true,
      },
    });

    // ─── 4. Build conversion tracking per factory ───
    const factoryMap: Record<string, {
      factoryId: string;
      factoryName: string;
      country: string;
      samples: { orderId: string; orderNumber?: string; brandName: string; status: string; date: string; volume: number }[];
      trials: { trialId: string; brandName: string; status: string; date: string; volume: number }[];
      productionOrders: { volume: number; revenue: number; status: string; date: string }[];
      converted: boolean;
      daysToConvert: number | null;
      accountManager: string;
    }> = {};

    // Process sample orders
    for (const sample of sampleOrders) {
      const fid = sample.factoryId;
      if (!factoryMap[fid]) {
        factoryMap[fid] = {
          factoryId: fid,
          factoryName: sample.factory?.name || "Unknown",
          country: sample.factory?.country || "",
          samples: [],
          trials: [],
          productionOrders: [],
          converted: false,
          daysToConvert: null,
          accountManager: sample.accountManager?.name || "Unassigned",
        };
      }

      const brandNames = sample.brandAllocations?.length > 0
        ? sample.brandAllocations.map((a) => a.brand?.name).filter(Boolean).join(", ")
        : sample.brand?.name || "—";

      factoryMap[fid].samples.push({
        orderId: sample.id,
        orderNumber: sample.orderNumber,
        brandName: brandNames,
        status: sample.status,
        date: sample.createdAt.toISOString(),
        volume: sample.volumeLiters || 0,
      });
    }

    // Process trial requests
    for (const trial of trials) {
      const fid = trial.factoryId;
      if (!factoryMap[fid]) {
        factoryMap[fid] = {
          factoryId: fid,
          factoryName: trial.factory?.name || "Unknown",
          country: trial.factory?.country || "",
          samples: [],
          trials: [],
          productionOrders: [],
          converted: false,
          daysToConvert: null,
          accountManager: "—",
        };
      }
      factoryMap[fid].trials.push({
        trialId: trial.id,
        brandName: trial.brand?.name || "—",
        status: trial.status,
        date: trial.createdAt.toISOString(),
        volume: trial.sampleVolumeLiters || 0,
      });
    }

    // Check for production conversions
    for (const fid of Object.keys(factoryMap)) {
      const factoryProdOrders = productionOrders.filter((o) => o.factoryId === fid);
      factoryMap[fid].productionOrders = factoryProdOrders.map((o) => ({
        volume: o.volumeLiters || 0,
        revenue: o.totalPrice || 0,
        status: o.status,
        date: o.createdAt.toISOString(),
      }));

      if (factoryProdOrders.length > 0) {
        factoryMap[fid].converted = true;

        // Calculate days to convert: first sample → first production order
        const firstSampleDate = [...factoryMap[fid].samples, ...factoryMap[fid].trials]
          .map((s) => new Date(s.date).getTime())
          .sort((a, b) => a - b)[0];
        const firstProdDate = factoryProdOrders
          .map((o) => new Date(o.date).getTime())
          .sort((a, b) => a - b)[0];

        if (firstSampleDate && firstProdDate && firstProdDate > firstSampleDate) {
          factoryMap[fid].daysToConvert = Math.round((firstProdDate - firstSampleDate) / (1000 * 60 * 60 * 24));
        }
      }
    }

    const factories = Object.values(factoryMap);
    const converted = factories.filter((f) => f.converted);
    const pending = factories.filter((f) => !f.converted);

    // ─── 5. Summary ───
    const totalSamples = factories.reduce((sum, f) => sum + f.samples.length + f.trials.length, 0);
    const totalConverted = converted.length;
    const conversionRate = factories.length > 0 ? Math.round((totalConverted / factories.length) * 100) : 0;
    const avgDaysToConvert = converted.filter((f) => f.daysToConvert !== null).length > 0
      ? Math.round(
          converted.filter((f) => f.daysToConvert !== null).reduce((sum, f) => sum + (f.daysToConvert || 0), 0) /
            converted.filter((f) => f.daysToConvert !== null).length
        )
      : null;
    const totalProductionRevenue = converted.reduce(
      (sum, f) => sum + f.productionOrders.reduce((s, o) => s + o.revenue, 0),
      0
    );
    const totalProductionLiters = converted.reduce(
      (sum, f) => sum + f.productionOrders.reduce((s, o) => s + o.volume, 0),
      0
    );

    return NextResponse.json({
      ok: true,
      summary: {
        totalFactoriesWithSamples: factories.length,
        totalSampleOrders: totalSamples,
        totalConverted,
        conversionRate,
        avgDaysToConvert,
        totalProductionRevenue: Math.round(totalProductionRevenue * 100) / 100,
        totalProductionLiters: Math.round(totalProductionLiters * 100) / 100,
        pendingConversion: pending.length,
      },
      converted: converted.sort((a, b) => (b.productionOrders.reduce((s, o) => s + o.volume, 0)) - (a.productionOrders.reduce((s, o) => s + o.volume, 0))),
      pending: pending.sort((a, b) => new Date(b.samples[0]?.date || b.trials[0]?.date || 0).getTime() - new Date(a.samples[0]?.date || a.trials[0]?.date || 0).getTime()),
    });
  } catch (e: any) {
    console.error("Conversion tracking error:", e);
    return NextResponse.json({ ok: false, error: "Failed to load conversion data" }, { status: 500 });
  }
}
