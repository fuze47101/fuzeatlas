// FUZE F1 pricing calculator — ported from fuzecost.com
// F1 stock: 30 ppm (mg/L), Bottle: 19 L

export type WidthUnit = "in" | "m";

export type CostAdder = {
  id: string;
  label: string;
  centsPerMeter: number;
  enabled: boolean;
};

export type CalcInputs = {
  gsm: number;
  width: number;
  widthUnit: WidthUnit;
  doseMgPerKg: number;
  stockMgPerL: number;    // 30 mg/L default
  pricePerLiter: number;  // default 36
  discountPercent: number;
  lengthMeters?: number;
  adders: CostAdder[];
};

export type CalcOutputs = {
  widthMeters: number;
  kgPerLinearMeter: number;
  mgPerLinearMeter: number;
  litersStockPerLinearMeter: number;
  effectivePricePerLiter: number;
  fuzeCostPerLinearMeter: number;
  addersPerLinearMeter: number;
  totalCostPerLinearMeter: number;
  costPerYard: number;
  costPerKg: number;
  costPerLb: number;
  totalLitersStock?: number;
  bottles19L?: number;
};

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export function widthToMeters(width: number, unit: WidthUnit) {
  const w = Number(width) || 0;
  return unit === "in" ? w * 0.0254 : w;
}

export function calcQuote(inputs: CalcInputs): CalcOutputs {
  const gsm = Math.max(0, Number(inputs.gsm) || 0);
  const widthMeters = Math.max(0, widthToMeters(inputs.width, inputs.widthUnit));
  const doseMgPerKg = Math.max(0, Number(inputs.doseMgPerKg) || 0);

  const stockMgPerL = Math.max(0.000001, Number(inputs.stockMgPerL) || 30);
  const pricePerLiter = Math.max(0, Number(inputs.pricePerLiter) || 0);
  const discountPercent = clamp(Number(inputs.discountPercent) || 0, 0, 100);

  const effectivePricePerLiter = pricePerLiter * (1 - discountPercent / 100);

  // kg per linear meter = GSM * width(m) / 1000
  const kgPerLinearMeter = (gsm * widthMeters) / 1000;

  // mg per linear meter = dose(mg/kg) * kg/m
  const mgPerLinearMeter = doseMgPerKg * kgPerLinearMeter;

  // liters stock per linear meter = mg/m / (mg/L)
  const litersStockPerLinearMeter = mgPerLinearMeter / stockMgPerL;

  // FUZE cost per meter
  const fuzeCostPerLinearMeter = litersStockPerLinearMeter * effectivePricePerLiter;

  // Adders in cents/m → dollars/m
  const addersPerLinearMeter = (inputs.adders || [])
    .filter((a) => a.enabled)
    .reduce((sum, a) => sum + (Number(a.centsPerMeter) || 0) / 100, 0);

  const totalCostPerLinearMeter = fuzeCostPerLinearMeter + addersPerLinearMeter;

  // Per yard
  const costPerYard = totalCostPerLinearMeter * 0.9144;

  // Per kg and per lb
  const costPerKg = kgPerLinearMeter > 0 ? totalCostPerLinearMeter / kgPerLinearMeter : 0;
  const costPerLb = costPerKg / 2.2046226218;

  // Job length calculation
  let totalLitersStock: number | undefined;
  let bottles19L: number | undefined;

  if (typeof inputs.lengthMeters === "number" && inputs.lengthMeters > 0) {
    totalLitersStock = litersStockPerLinearMeter * inputs.lengthMeters;
    bottles19L = Math.ceil(totalLitersStock / 19);
  }

  return {
    widthMeters,
    kgPerLinearMeter,
    mgPerLinearMeter,
    litersStockPerLinearMeter,
    effectivePricePerLiter,
    fuzeCostPerLinearMeter,
    addersPerLinearMeter,
    totalCostPerLinearMeter,
    costPerYard,
    costPerKg,
    costPerLb,
    totalLitersStock,
    bottles19L,
  };
}

// Currency formatting
export function money(n: number, currency: string, fx: number = 1): string {
  const val = n * fx;
  if (!Number.isFinite(val)) return currency === "USD" ? "$0.00" : `${currency} 0.00`;
  if (currency === "USD") {
    return val.toLocaleString(undefined, { style: "currency", currency: "USD" });
  }
  return `${currency} ${val.toFixed(2)}`;
}

export const CURRENCIES = [
  { code: "USD", label: "USD" },
  { code: "CNY", label: "RMB (CNY)" },
  { code: "TWD", label: "NTD (TWD)" },
  { code: "VND", label: "VND" },
  { code: "PKR", label: "PKR" },
  { code: "INR", label: "INR" },
  { code: "LKR", label: "LKR" },
  { code: "BDT", label: "BDT" },
];
