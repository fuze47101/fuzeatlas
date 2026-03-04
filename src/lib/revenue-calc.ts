// Revenue Pipeline & Forecast Calculation Utilities
// Uses FUZE pricing from fuze-calc.ts to project revenue

import { widthToMeters } from "./fuze-calc";

// ─── FUZE Tier Constants ─────────────────────────
export const FUZE_TIERS_COMMERCIAL = {
  F1: { id: "F1", label: "F1 — Full Spectrum", doseMgPerKg: 1.0, washes: 100 },
  F2: { id: "F2", label: "F2 — Advanced", doseMgPerKg: 0.75, washes: 75 },
  F3: { id: "F3", label: "F3 — Core", doseMgPerKg: 0.5, washes: 50 },
  F4: { id: "F4", label: "F4 — Foundation", doseMgPerKg: 0.25, washes: 25 },
} as const;

export type FuzeTierId = keyof typeof FUZE_TIERS_COMMERCIAL;

// ─── Pipeline Stage Constants ─────────────────────────
export const PROJECT_STAGES = [
  { id: "DEVELOPMENT", label: "Development", color: "bg-slate-400", order: 0 },
  { id: "SAMPLING", label: "Sampling", color: "bg-blue-400", order: 1 },
  { id: "TESTING", label: "Testing", color: "bg-violet-400", order: 2 },
  { id: "APPROVED", label: "Approved", color: "bg-amber-400", order: 3 },
  { id: "COMMERCIALIZATION", label: "Commercialization", color: "bg-orange-400", order: 4 },
  { id: "PRODUCTION", label: "Production", color: "bg-emerald-500", order: 5 },
  { id: "COMPLETE", label: "Complete", color: "bg-green-600", order: 6 },
] as const;

export type ProjectStageId = (typeof PROJECT_STAGES)[number]["id"];

export const INVOICE_STATUSES = [
  { id: "DRAFT", label: "Draft", color: "bg-slate-200 text-slate-700" },
  { id: "SENT", label: "Sent", color: "bg-blue-100 text-blue-700" },
  { id: "PAID", label: "Paid", color: "bg-emerald-100 text-emerald-700" },
  { id: "OVERDUE", label: "Overdue", color: "bg-red-100 text-red-700" },
  { id: "CANCELLED", label: "Cancelled", color: "bg-slate-100 text-slate-400" },
] as const;

// ─── Annual FUZE Liters Calculation ─────────────────────────
// Given annual production volume in meters, fabric specs, and FUZE tier,
// calculate how many liters of FUZE stock the factory will need per year.
export function calculateAnnualFuzeLiters(input: {
  annualVolumeMeters: number;
  fabricGsm: number;
  fabricWidthInches: number;
  fuzeTierDoseMgPerKg: number;
  stockMgPerL?: number; // default 30
}): number {
  const { annualVolumeMeters, fabricGsm, fabricWidthInches, fuzeTierDoseMgPerKg } = input;
  const stockMgPerL = input.stockMgPerL || 30;

  const widthMeters = widthToMeters(fabricWidthInches, "in");
  const kgPerMeter = (fabricGsm * widthMeters) / 1000;
  const mgPerMeter = fuzeTierDoseMgPerKg * kgPerMeter;
  const litersPerMeter = mgPerMeter / stockMgPerL;

  return litersPerMeter * annualVolumeMeters;
}

// ─── Annual FUZE Cost (Revenue) Calculation ─────────────────────────
export function calculateAnnualFuzeCost(input: {
  annualLiters: number;
  pricePerLiter?: number; // default $36
  discountPercent?: number;
}): number {
  const price = input.pricePerLiter || 36;
  const discount = input.discountPercent || 0;
  const effectivePrice = price * (1 - discount / 100);
  return input.annualLiters * effectivePrice;
}

// ─── Aggregate Projects by Distributor ─────────────────────────
export type ProjectForForecast = {
  id: string;
  name: string;
  projectedValue: number | null;
  probability: number;
  distributorId: string | null;
  distributorName?: string;
  brandName?: string;
  factoryName?: string;
  stage: string;
  expectedProductionDate: string | Date | null;
};

export function aggregateByDistributor(projects: ProjectForForecast[]): {
  distributorId: string;
  distributorName: string;
  totalProjected: number;
  weightedProjected: number;
  projectCount: number;
  avgProbability: number;
}[] {
  const map = new Map<string, { name: string; total: number; weighted: number; count: number; probSum: number }>();

  for (const p of projects) {
    const did = p.distributorId || "unassigned";
    const dname = p.distributorName || "Unassigned";
    const val = p.projectedValue || 0;

    const entry = map.get(did) || { name: dname, total: 0, weighted: 0, count: 0, probSum: 0 };
    entry.total += val;
    entry.weighted += val * (p.probability / 100);
    entry.count += 1;
    entry.probSum += p.probability;
    map.set(did, entry);
  }

  return Array.from(map.entries()).map(([id, e]) => ({
    distributorId: id,
    distributorName: e.name,
    totalProjected: Math.round(e.total * 100) / 100,
    weightedProjected: Math.round(e.weighted * 100) / 100,
    projectCount: e.count,
    avgProbability: e.count > 0 ? Math.round(e.probSum / e.count) : 0,
  }));
}

// ─── Group Projects by Quarter ─────────────────────────
export function aggregateByQuarter(projects: ProjectForForecast[], year: number): {
  quarter: string;
  startDate: string;
  endDate: string;
  totalValue: number;
  weightedValue: number;
  projectCount: number;
}[] {
  const quarters = [
    { q: `Q1 ${year}`, start: new Date(year, 0, 1), end: new Date(year, 2, 31) },
    { q: `Q2 ${year}`, start: new Date(year, 3, 1), end: new Date(year, 5, 30) },
    { q: `Q3 ${year}`, start: new Date(year, 6, 1), end: new Date(year, 8, 30) },
    { q: `Q4 ${year}`, start: new Date(year, 9, 1), end: new Date(year, 11, 31) },
  ];

  return quarters.map(({ q, start, end }) => {
    const inQuarter = projects.filter((p) => {
      if (!p.expectedProductionDate) return false;
      const d = new Date(p.expectedProductionDate);
      return d >= start && d <= end;
    });

    return {
      quarter: q,
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      totalValue: inQuarter.reduce((s, p) => s + (p.projectedValue || 0), 0),
      weightedValue: inQuarter.reduce((s, p) => s + (p.projectedValue || 0) * (p.probability / 100), 0),
      projectCount: inQuarter.length,
    };
  });
}

// ─── Invoice Metrics ─────────────────────────
export type InvoiceForMetrics = {
  amount: number;
  status: string;
  invoiceDate: string | Date;
  paidDate?: string | Date | null;
};

export function calculateInvoiceMetrics(invoices: InvoiceForMetrics[]): {
  totalOutstanding: number;
  totalPaid: number;
  totalOverdue: number;
  collectionRate: number;
  overdueCount: number;
  avgDaysToPay: number;
} {
  let totalOutstanding = 0;
  let totalPaid = 0;
  let totalOverdue = 0;
  let overdueCount = 0;
  let daysToPay: number[] = [];

  for (const inv of invoices) {
    if (inv.status === "PAID") {
      totalPaid += inv.amount;
      if (inv.paidDate) {
        const days = Math.floor(
          (new Date(inv.paidDate).getTime() - new Date(inv.invoiceDate).getTime()) / 86400000
        );
        if (days >= 0) daysToPay.push(days);
      }
    } else if (inv.status === "OVERDUE") {
      totalOverdue += inv.amount;
      totalOutstanding += inv.amount;
      overdueCount++;
    } else if (inv.status === "SENT" || inv.status === "DRAFT") {
      totalOutstanding += inv.amount;
    }
  }

  const totalBilled = totalPaid + totalOutstanding;
  const collectionRate = totalBilled > 0 ? (totalPaid / totalBilled) * 100 : 0;
  const avgDaysToPay = daysToPay.length > 0
    ? Math.round(daysToPay.reduce((a, b) => a + b, 0) / daysToPay.length)
    : 0;

  return {
    totalOutstanding: Math.round(totalOutstanding * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    totalOverdue: Math.round(totalOverdue * 100) / 100,
    collectionRate: Math.round(collectionRate * 10) / 10,
    overdueCount,
    avgDaysToPay,
  };
}

// ─── Format helpers ─────────────────────────
export function formatMoney(n: number, currency = "USD"): string {
  if (!Number.isFinite(n)) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export function daysAgo(date: string | Date): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}
