// @ts-nocheck
"use client";

import { useState, useEffect } from "react";

const PERIODS = [
  { value: "all", label: "All Time" },
  { value: "Q1-2026", label: "Q1 2026" },
  { value: "Q2-2026", label: "Q2 2026" },
  { value: "Q3-2026", label: "Q3 2026" },
  { value: "Q4-2026", label: "Q4 2026" },
  { value: "2025", label: "Full Year 2025" },
  { value: "2026", label: "Full Year 2026" },
];

export default function ESGReportsPage() {
  const [brands, setBrands] = useState<any[]>([]);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [period, setPeriod] = useState("all");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [brandsLoading, setBrandsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/brands?limit=200")
      .then((r) => r.json())
      .then((d) => setBrands(d.brands || []))
      .catch(() => {})
      .finally(() => setBrandsLoading(false));
  }, []);

  async function loadReport() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ period });
      if (selectedBrand) params.set("brandId", selectedBrand);
      const res = await fetch(`/api/admin/esg-report?${params}`);
      const d = await res.json();
      if (d.ok) setData(d);
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    loadReport();
  }, [selectedBrand, period]);

  const env = data?.environmentalImpact;
  const summary = data?.summary;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Environmental Impact Reports</h1>
          <p className="text-sm text-gray-500 mt-1">
            Sustainability data for brand ESG reporting — FUZE vs traditional antimicrobials
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => {
            const params = new URLSearchParams({ period });
            if (selectedBrand) params.set("brandId", selectedBrand);
            window.open(`/api/admin/esg-report/pdf?${params}`, "_blank");
          }}
          className="flex items-center gap-2 px-4 py-2 bg-[#00b4c3] text-white rounded-lg text-sm font-semibold hover:bg-[#0e7490] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download PDF Report
        </button>
        <button
          onClick={() => {
            const params = new URLSearchParams({ period });
            if (selectedBrand) params.set("brandId", selectedBrand);
            const shareUrl = `${window.location.origin}/api/admin/esg-report/pdf?${params}`;
            navigator.clipboard.writeText(shareUrl);
            alert("Report link copied to clipboard!");
          }}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          Share Link
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 mb-1">Brand</label>
          <select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none"
          >
            <option value="">All Brands (Worldwide)</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div className="w-48">
          <label className="block text-xs font-medium text-gray-500 mb-1">Period</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none"
          >
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && data && (
        <>
          {/* Brand Header */}
          {data.brand && (
            <div className="bg-gradient-to-r from-[#00b4c3]/10 to-green-50 border border-[#00b4c3]/20 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🌱</span>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    {data.brand.name} — FUZE Environmental Impact
                  </h2>
                  <p className="text-sm text-gray-600">
                    Period: {PERIODS.find((p) => p.value === period)?.label || "All Time"}
                    {data.brand.accountManager && ` · Account Manager: ${data.brand.accountManager}`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ─── Impact KPIs ─── */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <ImpactCard
              icon="🧪"
              label="Chemical Binders Eliminated"
              value={`${env?.binderEliminatedKg?.toLocaleString() || 0} kg`}
              detail="Zero binders needed — FUZE metamaterial bonds directly to fiber"
              color="bg-green-50 border-green-200"
              comparison="Traditional antimicrobials require 15-30 g/L of chemical binders"
            />
            <ImpactCard
              icon="⚡"
              label="Curing Energy Saved"
              value={`${env?.curingEnergySavedKwh?.toLocaleString() || 0} kWh`}
              detail="No heat curing step required with FUZE treatment"
              color="bg-amber-50 border-amber-200"
              comparison="Competitors need 150-180°C curing for 30-60 seconds per meter"
            />
            <ImpactCard
              icon="🌍"
              label="CO₂ Emissions Avoided"
              value={`${env?.co2AvoidedKg?.toLocaleString() || 0} kg`}
              detail="From eliminated curing energy and chemical production"
              color="bg-blue-50 border-blue-200"
              comparison={`Equivalent to ${Math.round((env?.co2AvoidedKg || 0) / 4.6)} car-days of driving`}
            />
            <ImpactCard
              icon="🚰"
              label="Wastewater Chemicals Avoided"
              value={`${env?.wastewaterChemicalsAvoidedKg?.toLocaleString() || 0} kg`}
              detail="No caustic soda, magnesium chloride, or activated carbon needed"
              color="bg-purple-50 border-purple-200"
              comparison="Traditional processes require extensive wastewater treatment"
            />
            <ImpactCard
              icon="💧"
              label="Water Saved"
              value={`${env?.waterSavedLiters?.toLocaleString() || 0} L`}
              detail="No rinse cycles needed — no binder residue to wash out"
              color="bg-cyan-50 border-cyan-200"
              comparison="Binder-based treatments need additional rinse water"
            />
            <ImpactCard
              icon="♻️"
              label="Recycled Electronics"
              value="Circular Economy"
              detail="FUZE metamaterial produced from recycled electronics feedstock"
              color="bg-emerald-50 border-emerald-200"
              comparison="Solar-capable production via liquid laser ablation"
            />
          </div>

          {/* ─── Usage Summary ─── */}
          <div className="bg-white rounded-xl border p-4 md:p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Treatment Summary</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-gray-500">Total FUZE Delivered</div>
                <div className="text-2xl font-bold text-gray-900">{summary?.totalLitersDelivered?.toLocaleString() || 0} L</div>
                <div className="text-xs text-gray-400">{summary?.totalKgDelivered?.toLocaleString() || 0} kg</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Estimated Fabric Processed</div>
                <div className="text-2xl font-bold text-gray-900">{summary?.estimatedMetersProcessed?.toLocaleString() || 0} m</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Total Orders</div>
                <div className="text-2xl font-bold text-gray-900">{summary?.totalOrders || 0}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Factories Served</div>
                <div className="text-2xl font-bold text-gray-900">{summary?.factoriesServed || 0}</div>
              </div>
            </div>
          </div>

          {/* ─── FUZE vs Competition ─── */}
          <div className="bg-white rounded-xl border p-4 md:p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">FUZE vs Traditional Antimicrobials</h3>
            <p className="text-sm text-gray-500 mb-4">
              Side-by-side comparison for ESG reporting
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-semibold text-gray-600 w-1/3">Category</th>
                    <th className="text-left py-2 px-3 font-semibold text-red-600 w-1/3">Traditional Antimicrobials</th>
                    <th className="text-left py-2 px-3 font-semibold text-green-600 w-1/3">FUZE Metamaterial</th>
                  </tr>
                </thead>
                <tbody>
                  {data.competitorComparison && (
                    <>
                      <CompRow label="Chemical Binders" bad={data.competitorComparison.traditionalAntimicrobial.binderRequired} good={data.competitorComparison.fuze.binderRequired} />
                      <CompRow label="Heat Curing" bad={data.competitorComparison.traditionalAntimicrobial.curingRequired} good={data.competitorComparison.fuze.curingRequired} />
                      <CompRow label="Wastewater Treatment" bad={data.competitorComparison.traditionalAntimicrobial.wastewaterTreatment} good={data.competitorComparison.fuze.wastewaterTreatment} />
                      <CompRow label="VOC Emissions" bad={data.competitorComparison.traditionalAntimicrobial.VOCs} good={data.competitorComparison.fuze.VOCs} />
                      <CompRow label="Wash Durability" bad={data.competitorComparison.traditionalAntimicrobial.leaching} good={data.competitorComparison.fuze.leaching} />
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ─── Factory Breakdown ─── */}
          {data.factoryBreakdown?.length > 0 && (
            <div className="bg-white rounded-xl border p-4 md:p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Factory Breakdown</h3>
              <div className="space-y-2">
                {data.factoryBreakdown.map((f: any, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-48 shrink-0">
                      <div className="font-medium text-sm text-gray-900">{f.name}</div>
                      <div className="text-xs text-gray-400">{f.country}</div>
                    </div>
                    <div className="flex-1 h-6 bg-gray-50 rounded overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded"
                        style={{
                          width: `${Math.max(5, (f.liters / (data.factoryBreakdown[0]?.liters || 1)) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="w-24 text-right font-mono text-sm font-semibold">
                      {f.liters?.toLocaleString()} L
                    </div>
                    <div className="w-16 text-right text-xs text-gray-400">{f.orders} orders</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ImpactCard({
  icon,
  label,
  value,
  detail,
  color,
  comparison,
}: {
  icon: string;
  label: string;
  value: string;
  detail: string;
  color: string;
  comparison: string;
}) {
  return (
    <div className={`rounded-xl border p-4 ${color} group relative`}>
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-xl font-bold text-gray-900">{value}</div>
      <div className="text-xs font-medium text-gray-700 mt-0.5">{label}</div>
      <div className="text-[11px] text-gray-500 mt-1.5">{detail}</div>
      <div className="mt-2 pt-2 border-t border-gray-200/60">
        <div className="text-[10px] text-gray-400 italic">{comparison}</div>
      </div>
    </div>
  );
}

function CompRow({ label, bad, good }: { label: string; bad: string; good: string }) {
  return (
    <tr className="border-b last:border-0 hover:bg-gray-50">
      <td className="py-3 px-3 font-medium text-gray-700">{label}</td>
      <td className="py-3 px-3 text-red-600 bg-red-50/50">{bad}</td>
      <td className="py-3 px-3 text-green-700 bg-green-50/50 font-medium">{good}</td>
    </tr>
  );
}
