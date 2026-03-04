// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/* ── GET /api/revenue/forecast ── Revenue forecasting by quarter/distributor ──── */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()), 10);
    const groupBy = searchParams.get("groupBy") || "distributor"; // distributor | brand | factory

    // Fetch all projects with commercial data
    const projects = await prisma.project.findMany({
      where: { projectedValue: { not: null } },
      include: {
        brand: { select: { id: true, name: true } },
        factory: { select: { id: true, name: true } },
        distributor: { select: { id: true, name: true } },
      },
    });

    // Fetch invoices for the year (actual revenue)
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59);

    const invoices = await prisma.invoice.findMany({
      where: {
        invoiceDate: { gte: yearStart, lte: yearEnd },
        status: { not: "CANCELLED" },
      },
      include: {
        distributor: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        factory: { select: { id: true, name: true } },
      },
    });

    // Build quarterly forecast
    const quarters = [
      { q: `Q1 ${year}`, start: new Date(year, 0, 1), end: new Date(year, 2, 31) },
      { q: `Q2 ${year}`, start: new Date(year, 3, 1), end: new Date(year, 5, 30) },
      { q: `Q3 ${year}`, start: new Date(year, 6, 1), end: new Date(year, 8, 30) },
      { q: `Q4 ${year}`, start: new Date(year, 9, 1), end: new Date(year, 11, 31) },
    ];

    const forecast = quarters.map(({ q, start, end }) => {
      // Projects expected to produce in this quarter
      const qProjects = projects.filter((p) => {
        if (!p.expectedProductionDate) return false;
        const d = new Date(p.expectedProductionDate);
        return d >= start && d <= end;
      });

      // Invoices in this quarter
      const qInvoices = invoices.filter((inv) => {
        const d = new Date(inv.invoiceDate);
        return d >= start && d <= end;
      });

      const projected = qProjects.reduce((s, p) => s + (p.projectedValue || 0), 0);
      const weighted = qProjects.reduce(
        (s, p) => s + (p.projectedValue || 0) * ((p.probability || 0) / 100), 0
      );
      const actual = qInvoices
        .filter((i) => i.status === "PAID")
        .reduce((s, i) => s + i.amount, 0);
      const invoiced = qInvoices.reduce((s, i) => s + i.amount, 0);

      // Group by dimension
      const grouped = groupByDimension(qProjects, qInvoices, groupBy);

      return {
        quarter: q,
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
        projected: Math.round(projected * 100) / 100,
        weighted: Math.round(weighted * 100) / 100,
        actual: Math.round(actual * 100) / 100,
        invoiced: Math.round(invoiced * 100) / 100,
        projectCount: qProjects.length,
        invoiceCount: qInvoices.length,
        breakdown: grouped,
      };
    });

    // Annual totals
    const annualProjected = projects.reduce((s, p) => s + (p.projectedValue || 0), 0);
    const annualWeighted = projects.reduce(
      (s, p) => s + (p.projectedValue || 0) * ((p.probability || 0) / 100), 0
    );
    const annualActual = invoices
      .filter((i) => i.status === "PAID")
      .reduce((s, i) => s + i.amount, 0);
    const annualInvoiced = invoices.reduce((s, i) => s + i.amount, 0);

    // Distributor summary (full year)
    const distributorSummary = buildDistributorSummary(projects, invoices);

    return NextResponse.json({
      ok: true,
      year,
      groupBy,
      forecast,
      annual: {
        projected: Math.round(annualProjected * 100) / 100,
        weighted: Math.round(annualWeighted * 100) / 100,
        actual: Math.round(annualActual * 100) / 100,
        invoiced: Math.round(annualInvoiced * 100) / 100,
        projectCount: projects.length,
        invoiceCount: invoices.length,
      },
      distributorSummary,
    });
  } catch (e: any) {
    console.error("Revenue forecast error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

function groupByDimension(projects: any[], invoices: any[], groupBy: string) {
  const map = new Map();

  for (const p of projects) {
    let key, name;
    if (groupBy === "brand") {
      key = p.brandId || "unassigned";
      name = p.brand?.name || "Unassigned";
    } else if (groupBy === "factory") {
      key = p.factoryId || "unassigned";
      name = p.factory?.name || "Unassigned";
    } else {
      key = p.distributorId || "unassigned";
      name = p.distributor?.name || "Unassigned";
    }
    const entry = map.get(key) || { name, projected: 0, weighted: 0, actual: 0 };
    entry.projected += p.projectedValue || 0;
    entry.weighted += (p.projectedValue || 0) * ((p.probability || 0) / 100);
    map.set(key, entry);
  }

  for (const inv of invoices) {
    let key, name;
    if (groupBy === "brand") {
      key = inv.brandId || "unassigned";
      name = inv.brand?.name || "Unassigned";
    } else if (groupBy === "factory") {
      key = inv.factoryId || "unassigned";
      name = inv.factory?.name || "Unassigned";
    } else {
      key = inv.distributorId || "unassigned";
      name = inv.distributor?.name || "Unassigned";
    }
    const entry = map.get(key) || { name, projected: 0, weighted: 0, actual: 0 };
    if (inv.status === "PAID") entry.actual += inv.amount;
    map.set(key, entry);
  }

  return Array.from(map.entries()).map(([id, e]) => ({
    id,
    name: e.name,
    projected: Math.round(e.projected * 100) / 100,
    weighted: Math.round(e.weighted * 100) / 100,
    actual: Math.round(e.actual * 100) / 100,
  }));
}

function buildDistributorSummary(projects: any[], invoices: any[]) {
  const map = new Map();
  for (const p of projects) {
    const did = p.distributorId || "unassigned";
    const entry = map.get(did) || {
      name: p.distributor?.name || "Unassigned",
      projectedRevenue: 0,
      weightedRevenue: 0,
      actualRevenue: 0,
      projectCount: 0,
    };
    entry.projectedRevenue += p.projectedValue || 0;
    entry.weightedRevenue += (p.projectedValue || 0) * ((p.probability || 0) / 100);
    entry.projectCount += 1;
    map.set(did, entry);
  }
  for (const inv of invoices) {
    if (inv.status !== "PAID") continue;
    const did = inv.distributorId || "unassigned";
    const entry = map.get(did) || {
      name: inv.distributor?.name || "Unassigned",
      projectedRevenue: 0,
      weightedRevenue: 0,
      actualRevenue: 0,
      projectCount: 0,
    };
    entry.actualRevenue += inv.amount;
    map.set(did, entry);
  }
  return Array.from(map.entries())
    .map(([id, e]) => ({ distributorId: id, ...e }))
    .sort((a, b) => b.projectedRevenue - a.projectedRevenue);
}
