// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/admin/esg-report/pdf?brandId=xxx&period=Q1-2026
 *
 * Returns a print-optimized HTML page for ESG Impact Report.
 * Brands can print to PDF from browser, or this HTML can be fetched
 * and converted server-side.
 */

const BINDER_ELIMINATED_PER_LITER = 20;
const CURING_ENERGY_SAVED_PER_METER = 0.5;
const WASTEWATER_CHEMICALS_PER_LITER = 5;
const CO2_PER_KWH = 0.5;
const WATER_SAVED_PER_LITER = 2;
const LITERS_PER_METER_TYPICAL = 0.05;

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return new Response("Unauthorized", { status: 401 });

    const isInternal = ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"].includes(user.role);
    const isBrand = ["BRAND_USER", "BRAND_MANAGER"].includes(user.role);
    if (!isInternal && !isBrand) {
      return new Response("Access denied", { status: 403 });
    }

    const url = new URL(req.url);
    const brandId = url.searchParams.get("brandId");
    const period = url.searchParams.get("period") || "all";
    const targetBrandId = isBrand ? user.brandId : brandId;

    // ─── Brand info ───
    let brandInfo: any = null;
    if (targetBrandId) {
      brandInfo = await prisma.brand.findUnique({
        where: { id: targetBrandId },
        select: { id: true, name: true, salesRep: { select: { name: true } } },
      });
    }

    // ─── Date range ───
    let dateFrom: Date | undefined;
    let dateTo: Date | undefined;
    let periodLabel = "All Time";
    if (period && period !== "all") {
      const match = period.match(/^Q(\d)-(\d{4})$/);
      if (match) {
        const q = parseInt(match[1]);
        const y = parseInt(match[2]);
        dateFrom = new Date(y, (q - 1) * 3, 1);
        dateTo = new Date(y, q * 3, 0, 23, 59, 59);
        periodLabel = `Q${q} ${y}`;
      } else if (/^\d{4}$/.test(period)) {
        dateFrom = new Date(parseInt(period), 0, 1);
        dateTo = new Date(parseInt(period), 11, 31, 23, 59, 59);
        periodLabel = period;
      }
    }

    // ─── Orders ───
    const orderWhere: any = { status: "DELIVERED" };
    if (targetBrandId) orderWhere.brandId = targetBrandId;
    if (dateFrom && dateTo) orderWhere.deliveredDate = { gte: dateFrom, lte: dateTo };

    const directOrders = await prisma.fuzeOrder.findMany({
      where: orderWhere,
      select: {
        volumeLiters: true,
        fuzeTier: true,
        factory: { select: { name: true, country: true } },
      },
    });

    // Brand allocations
    const allocationWhere: any = {};
    if (targetBrandId) allocationWhere.brandId = targetBrandId;
    allocationWhere.order = dateFrom && dateTo
      ? { deliveredDate: { gte: dateFrom, lte: dateTo }, status: "DELIVERED" }
      : { status: "DELIVERED" };

    const allocations = await prisma.orderBrandAllocation.findMany({
      where: allocationWhere,
      select: {
        allocatedLiters: true,
        allocatedPct: true,
        order: { select: { volumeLiters: true } },
      },
    });

    const directLiters = directOrders.reduce((sum, o) => sum + (o.volumeLiters || 0), 0);
    const allocatedLiters = allocations.reduce((sum, a) => {
      if (a.allocatedLiters) return sum + a.allocatedLiters;
      if (a.allocatedPct && a.order?.volumeLiters) return sum + (a.order.volumeLiters * a.allocatedPct / 100);
      return sum;
    }, 0);
    const totalLiters = Math.max(directLiters, allocatedLiters) || directLiters + allocatedLiters;

    // Consumption for meters
    const consumptionWhere: any = {};
    if (targetBrandId) consumptionWhere.brandId = targetBrandId;
    if (dateFrom && dateTo) consumptionWhere.usageDate = { gte: dateFrom, lte: dateTo };
    const consumptions = await prisma.fuzeConsumption.findMany({
      where: consumptionWhere,
      select: { metersProcessed: true },
    });
    const totalMeters = consumptions.reduce((sum, c) => sum + (c.metersProcessed || 0), 0);
    const estimatedMeters = totalMeters > 0 ? totalMeters : totalLiters / LITERS_PER_METER_TYPICAL;

    // ─── Impact ───
    const binderKg = Math.round((totalLiters * BINDER_ELIMINATED_PER_LITER) / 1000 * 10) / 10;
    const curingKwh = Math.round(estimatedMeters * CURING_ENERGY_SAVED_PER_METER);
    const co2Kg = Math.round(estimatedMeters * CURING_ENERGY_SAVED_PER_METER * CO2_PER_KWH * 10) / 10;
    const wastewaterKg = Math.round((totalLiters * WASTEWATER_CHEMICALS_PER_LITER) / 1000 * 10) / 10;
    const waterL = Math.round(totalLiters * WATER_SAVED_PER_LITER);
    const carDays = Math.round(co2Kg / 4.6);

    // Factory breakdown
    const factoryMap: Record<string, { name: string; country: string; liters: number; orders: number }> = {};
    directOrders.forEach((o) => {
      const key = o.factory?.name || "Unknown";
      if (!factoryMap[key]) factoryMap[key] = { name: key, country: o.factory?.country || "", liters: 0, orders: 0 };
      factoryMap[key].liters += o.volumeLiters || 0;
      factoryMap[key].orders += 1;
    });
    const factories = Object.values(factoryMap).sort((a, b) => b.liters - a.liters);

    const brandName = brandInfo?.name || "All Brands (Worldwide)";
    const amName = brandInfo?.salesRep?.name || "";
    const generatedDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    // ─── Generate HTML ───
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FUZE Environmental Impact Report — ${brandName}</title>
  <style>
    @page { size: A4; margin: 15mm 20mm; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; line-height: 1.5; background: white; }

    .header { background: linear-gradient(135deg, #0e7490, #00b4c3); color: white; padding: 40px; border-radius: 0 0 20px 20px; }
    .header h1 { font-size: 28px; font-weight: 800; margin-bottom: 4px; }
    .header .subtitle { font-size: 14px; opacity: 0.9; }
    .header .meta { margin-top: 16px; font-size: 12px; opacity: 0.8; display: flex; gap: 24px; flex-wrap: wrap; }

    .content { max-width: 800px; margin: 0 auto; padding: 30px 20px; }

    .section { margin-bottom: 32px; }
    .section-title { font-size: 18px; font-weight: 700; color: #0e7490; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }

    .kpi-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
    .kpi-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; text-align: center; }
    .kpi-card .icon { font-size: 28px; margin-bottom: 8px; }
    .kpi-card .value { font-size: 24px; font-weight: 800; color: #0e7490; }
    .kpi-card .label { font-size: 11px; font-weight: 600; color: #64748b; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    .kpi-card .detail { font-size: 10px; color: #94a3b8; margin-top: 8px; }
    .kpi-card.green { background: #f0fdf4; border-color: #bbf7d0; }
    .kpi-card.amber { background: #fffbeb; border-color: #fde68a; }
    .kpi-card.blue { background: #eff6ff; border-color: #bfdbfe; }
    .kpi-card.purple { background: #faf5ff; border-color: #e9d5ff; }
    .kpi-card.cyan { background: #ecfeff; border-color: #a5f3fc; }
    .kpi-card.emerald { background: #ecfdf5; border-color: #a7f3d0; }

    .summary-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 16px; }
    .summary-item .value { font-size: 22px; font-weight: 800; color: #1e293b; }
    .summary-item .label { font-size: 11px; color: #64748b; }

    .comp-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .comp-table th { text-align: left; padding: 10px 12px; border-bottom: 2px solid #e2e8f0; font-weight: 700; }
    .comp-table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }
    .comp-table .bad { color: #dc2626; background: #fef2f2; }
    .comp-table .good { color: #16a34a; background: #f0fdf4; font-weight: 600; }
    .comp-table .category { font-weight: 600; color: #475569; }

    .factory-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
    .factory-name { width: 180px; flex-shrink: 0; }
    .factory-name .name { font-weight: 600; font-size: 13px; }
    .factory-name .country { font-size: 10px; color: #94a3b8; }
    .factory-bar { flex: 1; height: 20px; background: #f1f5f9; border-radius: 4px; overflow: hidden; }
    .factory-bar .fill { height: 100%; background: linear-gradient(90deg, #00b4c3, #34d399); border-radius: 4px; }
    .factory-value { width: 80px; text-align: right; font-weight: 700; font-size: 13px; font-family: monospace; }

    .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #e2e8f0; text-align: center; font-size: 10px; color: #94a3b8; }
    .footer .logo { font-weight: 800; font-size: 14px; color: #0e7490; margin-bottom: 4px; }

    .print-btn { position: fixed; bottom: 24px; right: 24px; background: #0e7490; color: white; border: none; padding: 14px 28px; border-radius: 12px; font-size: 14px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 20px rgba(0,0,0,0.15); z-index: 100; display: flex; align-items: center; gap: 8px; }
    .print-btn:hover { background: #0c6577; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
    Save as PDF
  </button>

  <div class="header">
    <h1>FUZE Environmental Impact Report</h1>
    <div class="subtitle">${brandName}</div>
    <div class="meta">
      <span>Period: ${periodLabel}</span>
      ${amName ? `<span>Account Manager: ${amName}</span>` : ""}
      <span>Generated: ${generatedDate}</span>
    </div>
  </div>

  <div class="content">
    <!-- Executive Summary -->
    <div class="section">
      <div class="section-title">Executive Summary</div>
      <p style="font-size: 13px; color: #475569; margin-bottom: 16px;">
        FUZE metamaterial treatment eliminates the need for chemical binders, heat curing, and harsh wastewater treatment chemicals
        required by traditional antimicrobial technologies. This report quantifies the environmental impact of choosing FUZE
        for ${brandName === "All Brands (Worldwide)" ? "your" : brandName + "'s"} textile antimicrobial program.
      </p>
      <div class="summary-grid">
        <div class="summary-item">
          <div class="value">${totalLiters.toLocaleString()} L</div>
          <div class="label">FUZE Delivered</div>
        </div>
        <div class="summary-item">
          <div class="value">${Math.round(estimatedMeters).toLocaleString()} m</div>
          <div class="label">Fabric Processed</div>
        </div>
        <div class="summary-item">
          <div class="value">${directOrders.length}</div>
          <div class="label">Orders Fulfilled</div>
        </div>
        <div class="summary-item">
          <div class="value">${factories.length}</div>
          <div class="label">Factories Served</div>
        </div>
      </div>
    </div>

    <!-- Environmental Impact KPIs -->
    <div class="section">
      <div class="section-title">Environmental Impact</div>
      <div class="kpi-grid">
        <div class="kpi-card green">
          <div class="icon">🧪</div>
          <div class="value">${binderKg.toLocaleString()} kg</div>
          <div class="label">Chemical Binders Eliminated</div>
          <div class="detail">Zero binders needed — FUZE bonds directly to fiber</div>
        </div>
        <div class="kpi-card amber">
          <div class="icon">⚡</div>
          <div class="value">${curingKwh.toLocaleString()} kWh</div>
          <div class="label">Curing Energy Saved</div>
          <div class="detail">No 150-180°C heat curing step required</div>
        </div>
        <div class="kpi-card blue">
          <div class="icon">🌍</div>
          <div class="value">${co2Kg.toLocaleString()} kg</div>
          <div class="label">CO₂ Emissions Avoided</div>
          <div class="detail">Equivalent to ${carDays} car-days of driving</div>
        </div>
        <div class="kpi-card purple">
          <div class="icon">🚰</div>
          <div class="value">${wastewaterKg.toLocaleString()} kg</div>
          <div class="label">Wastewater Chemicals Avoided</div>
          <div class="detail">No caustic soda, magnesium chloride, or activated carbon</div>
        </div>
        <div class="kpi-card cyan">
          <div class="icon">💧</div>
          <div class="value">${waterL.toLocaleString()} L</div>
          <div class="label">Water Saved</div>
          <div class="detail">No rinse cycles — no binder residue to wash out</div>
        </div>
        <div class="kpi-card emerald">
          <div class="icon">♻️</div>
          <div class="value">Circular</div>
          <div class="label">Recycled Electronics</div>
          <div class="detail">Metamaterial from recycled electronics via solar-capable laser</div>
        </div>
      </div>
    </div>

    <!-- FUZE vs Competition -->
    <div class="section page-break">
      <div class="section-title">FUZE vs Traditional Antimicrobials</div>
      <table class="comp-table">
        <thead>
          <tr>
            <th style="width:30%">Category</th>
            <th style="width:35%; color: #dc2626;">Traditional Antimicrobials</th>
            <th style="width:35%; color: #16a34a;">FUZE Metamaterial</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="category">Chemical Binders</td>
            <td class="bad">15-30 g/L chemical binder required</td>
            <td class="good">ZERO — no binder needed</td>
          </tr>
          <tr>
            <td class="category">Heat Curing</td>
            <td class="bad">150-180°C for 30-60 seconds</td>
            <td class="good">ZERO — no heat curing step</td>
          </tr>
          <tr>
            <td class="category">Carrier Chemistry</td>
            <td class="bad">Solvents, acids, harsh chemicals</td>
            <td class="good">99.998% ultrapure DI water</td>
          </tr>
          <tr>
            <td class="category">VOC Emissions</td>
            <td class="bad">Volatile organic compounds released during application</td>
            <td class="good">ZERO — water-based, no VOCs</td>
          </tr>
          <tr>
            <td class="category">Wastewater Treatment</td>
            <td class="bad">Caustic soda, MgCl₂, activated carbon required</td>
            <td class="good">ZERO — no additional treatment needed</td>
          </tr>
          <tr>
            <td class="category">Wash Durability</td>
            <td class="bad">Active ingredient leaches with each wash</td>
            <td class="good">Metamaterial bonds to fiber — superior durability</td>
          </tr>
          <tr>
            <td class="category">Raw Material Source</td>
            <td class="bad">Mined or synthesized from virgin materials</td>
            <td class="good">Recycled electronics feedstock — circular economy</td>
          </tr>
          <tr>
            <td class="category">Production Energy</td>
            <td class="bad">Chemical synthesis plants, high energy input</td>
            <td class="good">30-amp laser, solar-capable production</td>
          </tr>
        </tbody>
      </table>
    </div>

    ${factories.length > 0 ? `
    <!-- Factory Breakdown -->
    <div class="section">
      <div class="section-title">Factory Breakdown</div>
      ${factories.map((f, i) => `
        <div class="factory-row">
          <div class="factory-name">
            <div class="name">${f.name}</div>
            <div class="country">${f.country}</div>
          </div>
          <div class="factory-bar">
            <div class="fill" style="width: ${Math.max(5, (f.liters / (factories[0]?.liters || 1)) * 100)}%"></div>
          </div>
          <div class="factory-value">${f.liters.toLocaleString()} L</div>
        </div>
      `).join("")}
    </div>
    ` : ""}

    <!-- Methodology -->
    <div class="section">
      <div class="section-title">Methodology</div>
      <p style="font-size: 11px; color: #64748b; line-height: 1.7;">
        Environmental impact is calculated based on delivered FUZE volume and estimated fabric meters processed.
        Binder elimination assumes industry average of 20g/L for traditional antimicrobial treatments.
        Curing energy savings calculated at 0.5 kWh/meter based on typical 150-180°C curing requirements.
        CO₂ equivalence uses global average grid emission factor of 0.5 kg CO₂/kWh.
        Water savings account for eliminated binder rinse cycles at 2L per liter of treatment.
        All figures represent estimated savings compared to conventional antimicrobial treatment processes.
      </p>
    </div>

    <div class="footer">
      <div class="logo">FUZE BIOTECH</div>
      <p>1895 West 2100 South, Salt Lake City, Utah 84119 USA</p>
      <p>This report was generated by FUZE Atlas — fuzeatlas.com</p>
      <p style="margin-top: 8px;">Confidential — prepared for ${brandName}</p>
    </div>
  </div>
</body>
</html>`;

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (e: any) {
    console.error("ESG PDF error:", e);
    return new Response("Failed to generate report", { status: 500 });
  }
}
