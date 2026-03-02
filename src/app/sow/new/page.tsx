"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const FINANCIAL_OPTIONS = [
  { value: "BRAND_COVERS_AB_ICP", label: "Brand covers antimicrobial + ICP" },
  { value: "FIFTY_FIFTY", label: "50/50 cost share (approved level)" },
  { value: "BRAND_100", label: "Brand covers 100% testing (custom level)" },
  { value: "DEV_RETAINER", label: "Development Retainer" },
];

export default function NewSOWPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Loading...</div>}>
      <NewSOWPageInner />
    </Suspense>
  );
}

function NewSOWPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillBrandId = searchParams.get("brandId") || "";

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [gateErrors, setGateErrors] = useState<string[]>([]);
  const [revenueWarning, setRevenueWarning] = useState("");
  const [brands, setBrands] = useState<any[]>([]);
  const [factories, setFactories] = useState<any[]>([]);
  const [distributors, setDistributors] = useState<any[]>([]);
  const [labs, setLabs] = useState<any[]>([]);
  const [step, setStep] = useState(0);
  const [brandProducts, setBrandProducts] = useState<any[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", productType: "", sku: "", description: "" });
  const [addingProduct, setAddingProduct] = useState(false);

  const [form, setForm] = useState({
    // Section 1: Commercial Ownership
    brandId: prefillBrandId, executiveSponsor: "", factoryId: "",
    distributorId: "", salesRepName: "", title: "",
    // Section 2: End Use Definition
    garmentSku: "", fabricType: "", gsm: "", applicationLevel: "",
    targetLaunchSeason: "", retailChannel: "",
    // Section 3: Volume Forecast
    projectedAnnualUnits: "", garmentWeight: "",
    calculatedAnnualLiters: "", projectedAnnualRevenue: "",
    targetCommercializationDate: "",
    // Section 4: Success Criteria
    icpTarget: "", antimicrobialStandard: "", requiredLogReduction: "",
    washDurability: "", approvedTestingLab: "",
    // Section 5: Financial Participation
    financialParticipation: "", developmentRetainer: "",
    // Section 6: Commitment
    commitmentVolumeLiters: "",
    // Signatory
    signatory: "", signatoryTitle: "", signatoryEmail: "",
  });

  useEffect(() => {
    fetch("/api/brands").then(r => r.json()).then(j => {
      if (j.ok) {
        const all: any[] = [];
        Object.values(j.grouped).forEach((arr: any) => arr.forEach((b: any) => all.push(b)));
        setBrands(all.sort((a, b) => a.name.localeCompare(b.name)));
      }
    }).catch(() => {});
    fetch("/api/factories").then(r => r.json()).then(j => { if (j.ok) setFactories(j.factories); }).catch(() => {});
    // Fetch distributors and labs inline
    fetch("/api/distributors").then(r => r.json()).then(j => { if (j.ok) setDistributors(j.distributors); }).catch(() => {});
    fetch("/api/labs").then(r => r.json()).then(j => { if (j.ok) setLabs(j.labs); }).catch(() => {});
  }, []);

  // Load products when brand changes
  useEffect(() => {
    if (form.brandId) {
      fetch(`/api/brands/${form.brandId}/products`).then(r => r.json()).then(j => {
        if (j.ok) setBrandProducts(j.products);
      }).catch(() => {});
    } else {
      setBrandProducts([]);
      setSelectedProductIds([]);
    }
  }, [form.brandId]);

  const handleAddProductInline = async () => {
    if (!newProduct.name.trim() || !form.brandId) return;
    setAddingProduct(true);
    try {
      const res = await fetch(`/api/brands/${form.brandId}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProduct),
      });
      const j = await res.json();
      if (j.ok) {
        setBrandProducts(prev => [...prev, j.product]);
        setSelectedProductIds(prev => [...prev, j.product.id]);
        setNewProduct({ name: "", productType: "", sku: "", description: "" });
        setShowAddProduct(false);
      }
    } catch {} finally { setAddingProduct(false); }
  };

  const toggleProduct = (pid: string) => {
    setSelectedProductIds(prev => prev.includes(pid) ? prev.filter(x => x !== pid) : [...prev, pid]);
  };

  const set = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }));

  // Auto-calculate liters
  useEffect(() => {
    if (form.projectedAnnualUnits && form.garmentWeight) {
      const units = parseFloat(form.projectedAnnualUnits);
      const weight = parseFloat(form.garmentWeight);
      if (!isNaN(units) && !isNaN(weight)) {
        // Rough formula: units * weight * application rate / 1000
        const appLevel = parseFloat(form.applicationLevel) || 20; // default 20 mg/kg
        const liters = (units * weight * appLevel / 1000000).toFixed(0);
        set("calculatedAnnualLiters", liters);
      }
    }
  }, [form.projectedAnnualUnits, form.garmentWeight, form.applicationLevel]);

  // Revenue threshold check
  const revenue = parseFloat(form.projectedAnnualRevenue) || 0;
  const belowThreshold = revenue > 0 && revenue < 25000;

  // Stage 0 gate validation
  const gate0 = {
    executiveSponsor: !!form.executiveSponsor,
    garmentSku: !!(form.garmentSku || selectedProductIds.length > 0),
    targetLaunchSeason: !!form.targetLaunchSeason,
    factoryId: !!form.factoryId,
    volume: !!(form.projectedAnnualUnits || form.calculatedAnnualLiters),
    brandId: !!form.brandId,
  };
  const gate0Pass = Object.values(gate0).every(Boolean);

  const steps = [
    { label: "1. Commercial Ownership", icon: "🏢" },
    { label: "2. End Use Definition", icon: "👕" },
    { label: "3. Volume Forecast", icon: "📊" },
    { label: "4. Success Criteria", icon: "🎯" },
    { label: "5. Financial Participation", icon: "💰" },
    { label: "6. Commitment & Sign", icon: "✍️" },
  ];

  const handleSubmit = async () => {
    setSaving(true); setError(""); setGateErrors([]);
    try {
      const res = await fetch("/api/sow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, productIds: selectedProductIds }),
      });
      const j = await res.json();
      if (j.ok) {
        if (j.revenueWarning) setRevenueWarning(j.revenueWarning);
        router.push(`/sow/${j.sow.id}`);
      } else {
        if (j.gateErrors) {
          setGateErrors(j.gateErrors);
          setStep(0); // Go back to section with missing fields
        }
        setError(j.error || "Failed to create SOW");
      }
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="max-w-[900px] mx-auto">
      <button onClick={() => router.push("/sow")} className="text-sm text-blue-600 hover:underline mb-2 block">&larr; Back to SOWs</button>
      <h1 className="text-2xl font-black text-slate-900 mb-1">New Commercialization SOW</h1>
      <p className="text-sm text-slate-500 mb-6">FUZE Technologies — Stage-Gate Commercialization & Development</p>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-red-700 text-sm font-semibold">{error}</div>
          {gateErrors.length > 0 && (
            <ul className="mt-2 text-red-600 text-sm list-disc list-inside">
              {gateErrors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}

      {belowThreshold && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
          ⚠️ Below $25,000 minimum revenue threshold. Requires executive override or paid development classification.
        </div>
      )}

      {/* Step navigation */}
      <div className="flex gap-1 mb-6">
        {steps.map((s, i) => (
          <button key={i} onClick={() => setStep(i)}
            className={`flex-1 py-2 px-2 text-xs font-semibold rounded-lg transition-colors ${step === i ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border">
        {/* Section 1: Commercial Ownership */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">🏢 Commercial Ownership
              {!gate0Pass && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Gate requirements below</span>}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Brand <span className="text-red-500">* GATE</span></label>
                <select value={form.brandId} onChange={e => set("brandId", e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${!gate0.brandId ? "border-red-300 bg-red-50" : "border-slate-300"}`}>
                  <option value="">Select brand...</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Executive Sponsor (Director+) <span className="text-red-500">* GATE</span></label>
                <input type="text" value={form.executiveSponsor} onChange={e => set("executiveSponsor", e.target.value)}
                  placeholder="Name of Director+ sponsor"
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${!gate0.executiveSponsor ? "border-red-300 bg-red-50" : "border-slate-300"}`} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Factory <span className="text-red-500">* GATE</span></label>
                <select value={form.factoryId} onChange={e => set("factoryId", e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${!gate0.factoryId ? "border-red-300 bg-red-50" : "border-slate-300"}`}>
                  <option value="">Select factory...</option>
                  {factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Distributor</label>
                <select value={form.distributorId} onChange={e => set("distributorId", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select distributor...</option>
                  {distributors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Sales Representative</label>
                <input type="text" value={form.salesRepName} onChange={e => set("salesRepName", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">SOW Title</label>
                <input type="text" value={form.title} onChange={e => set("title", e.target.value)} placeholder="Auto-generated if blank"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            {/* Stage 0 gate status */}
            <div className="mt-4 p-3 bg-slate-50 rounded-lg">
              <h3 className="text-xs font-bold text-slate-600 mb-2">Stage 0 — Commercial Qualification Gate</h3>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {[
                  ["Brand selected", gate0.brandId],
                  ["Executive Sponsor", gate0.executiveSponsor],
                  ["Factory assigned", gate0.factoryId],
                  ["Product/SKU defined", gate0.garmentSku],
                  ["Launch season set", gate0.targetLaunchSeason],
                  ["Volume forecasted", gate0.volume],
                ].map(([label, pass]) => (
                  <div key={label as string} className={`flex items-center gap-1 ${pass ? "text-green-600" : "text-red-500"}`}>
                    {pass ? "✓" : "✗"} {label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Section 2: End Use */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900">👕 End Use Definition</h2>

            {/* Products section */}
            <div className={`p-4 rounded-lg border ${!gate0.garmentSku ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}`}>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold text-slate-600">Products / SKUs <span className="text-red-500">* GATE</span></label>
                {form.brandId && (
                  <button type="button" onClick={() => setShowAddProduct(true)} className="text-xs text-blue-600 hover:underline font-semibold">+ Add Product</button>
                )}
              </div>
              {!form.brandId ? (
                <p className="text-xs text-slate-400">Select a brand first to see products</p>
              ) : brandProducts.length === 0 && !showAddProduct ? (
                <p className="text-xs text-slate-400">No products for this brand. Add one or use the SKU field below.</p>
              ) : (
                <div className="space-y-1">
                  {brandProducts.map(p => (
                    <label key={p.id} className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${selectedProductIds.includes(p.id) ? "bg-white border-green-300" : "bg-white/50 border-slate-200 hover:bg-white"}`}>
                      <input type="checkbox" checked={selectedProductIds.includes(p.id)} onChange={() => toggleProduct(p.id)} className="accent-green-600" />
                      <div className="flex-1">
                        <span className="text-sm font-semibold text-slate-900">{p.name}</span>
                        {p.productType && <span className="text-xs text-slate-500 ml-2">{p.productType}</span>}
                        {p.sku && <span className="text-xs text-slate-400 ml-2 font-mono">{p.sku}</span>}
                      </div>
                    </label>
                  ))}
                </div>
              )}
              {showAddProduct && form.brandId && (
                <div className="mt-2 p-3 bg-white rounded-lg border border-slate-200">
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input type="text" value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                      className="px-2 py-1.5 border border-slate-300 rounded text-sm" placeholder="Product name *" autoFocus />
                    <input type="text" value={newProduct.productType} onChange={e => setNewProduct({ ...newProduct, productType: e.target.value })}
                      className="px-2 py-1.5 border border-slate-300 rounded text-sm" placeholder="Type (Garment, Textile...)" />
                    <input type="text" value={newProduct.sku} onChange={e => setNewProduct({ ...newProduct, sku: e.target.value })}
                      className="px-2 py-1.5 border border-slate-300 rounded text-sm" placeholder="SKU / Style #" />
                    <input type="text" value={newProduct.description} onChange={e => setNewProduct({ ...newProduct, description: e.target.value })}
                      className="px-2 py-1.5 border border-slate-300 rounded text-sm" placeholder="Description" />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={handleAddProductInline} disabled={addingProduct || !newProduct.name.trim()}
                      className="px-3 py-1 bg-green-600 text-white text-xs font-semibold rounded hover:bg-green-700 disabled:opacity-50">
                      {addingProduct ? "..." : "Add"}
                    </button>
                    <button type="button" onClick={() => { setShowAddProduct(false); setNewProduct({ name: "", productType: "", sku: "", description: "" }); }}
                      className="px-3 py-1 text-xs text-slate-500 border border-slate-300 rounded hover:bg-slate-50">Cancel</button>
                  </div>
                </div>
              )}
              <div className="mt-2">
                <label className="block text-xs text-slate-500 mb-1">Or enter a legacy SKU / Style # directly</label>
                <input type="text" value={form.garmentSku} onChange={e => set("garmentSku", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. NK-DRF-2026" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Fabric Type</label>
                <input type="text" value={form.fabricType} onChange={e => set("fabricType", e.target.value)} placeholder="e.g. Knit, Woven"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">GSM</label>
                <input type="number" value={form.gsm} onChange={e => set("gsm", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Application Level (mg/kg)</label>
                <input type="number" value={form.applicationLevel} onChange={e => set("applicationLevel", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Target Launch Season <span className="text-red-500">* GATE</span></label>
                <input type="text" value={form.targetLaunchSeason} onChange={e => set("targetLaunchSeason", e.target.value)} placeholder="e.g. Fall 2026"
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${!gate0.targetLaunchSeason ? "border-red-300 bg-red-50" : "border-slate-300"}`} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Retail Channel</label>
                <input type="text" value={form.retailChannel} onChange={e => set("retailChannel", e.target.value)} placeholder="e.g. Direct, Wholesale, Amazon"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>
        )}

        {/* Section 3: Volume Forecast */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900">📊 Volume Forecast</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Projected Annual Units <span className="text-red-500">* GATE</span></label>
                <input type="number" value={form.projectedAnnualUnits} onChange={e => set("projectedAnnualUnits", e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${!gate0.volume ? "border-red-300 bg-red-50" : "border-slate-300"}`} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Garment Weight (kg)</label>
                <input type="number" step="0.01" value={form.garmentWeight} onChange={e => set("garmentWeight", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Calculated Annual Liters</label>
                <input type="number" value={form.calculatedAnnualLiters} onChange={e => set("calculatedAnnualLiters", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50" />
                <p className="text-[10px] text-slate-400 mt-1">Auto-calculated from units × weight × application level</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Projected Annual FUZE Revenue ($)</label>
                <input type="number" value={form.projectedAnnualRevenue} onChange={e => set("projectedAnnualRevenue", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                {belowThreshold && <p className="text-[10px] text-amber-600 mt-1">⚠️ Below $25K minimum threshold</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Target Commercialization Date</label>
                <input type="date" value={form.targetCommercializationDate} onChange={e => set("targetCommercializationDate", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>
        )}

        {/* Section 4: Success Criteria */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900">🎯 Success Criteria</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">ICP Target</label>
                <input type="text" value={form.icpTarget} onChange={e => set("icpTarget", e.target.value)} placeholder="e.g. Ag 100-150 mg/kg"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Antimicrobial Standard</label>
                <input type="text" value={form.antimicrobialStandard} onChange={e => set("antimicrobialStandard", e.target.value)} placeholder="e.g. AATCC 100, ISO 20743"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Required Log Reduction</label>
                <input type="text" value={form.requiredLogReduction} onChange={e => set("requiredLogReduction", e.target.value)} placeholder="e.g. ≥ 2.0 log"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Wash Durability</label>
                <input type="text" value={form.washDurability} onChange={e => set("washDurability", e.target.value)} placeholder="e.g. 50 washes"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Approved Testing Lab</label>
                <select value={form.approvedTestingLab} onChange={e => set("approvedTestingLab", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select lab...</option>
                  {labs.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Section 5: Financial Participation */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900">💰 Financial Participation</h2>
            <div className="space-y-3">
              {FINANCIAL_OPTIONS.map(opt => (
                <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${form.financialParticipation === opt.value ? "bg-blue-50 border-blue-300" : "bg-white border-slate-200 hover:bg-slate-50"}`}>
                  <input type="radio" name="financial" value={opt.value} checked={form.financialParticipation === opt.value}
                    onChange={e => set("financialParticipation", e.target.value)} className="accent-blue-600" />
                  <span className="text-sm text-slate-700">{opt.label}</span>
                </label>
              ))}
            </div>
            {form.financialParticipation === "DEV_RETAINER" && (
              <div className="mt-3">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Development Retainer Amount ($)</label>
                <input type="number" value={form.developmentRetainer} onChange={e => set("developmentRetainer", e.target.value)} placeholder="10,000 - 25,000"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <p className="text-[10px] text-slate-400 mt-1">New product categories: $10,000 - $25,000</p>
              </div>
            )}
          </div>
        )}

        {/* Section 6: Commitment & Signatures */}
        {step === 5 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900">✍️ Commercialization Commitment</h2>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              If technical success criteria are met, parties intend to commercialize within 6 months with projected annual volume.
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Commitment Volume (liters)</label>
                <input type="number" value={form.commitmentVolumeLiters} onChange={e => set("commitmentVolumeLiters", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <h3 className="text-sm font-bold text-slate-700 mt-4">Authorized Signatory</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Name</label>
                <input type="text" value={form.signatory} onChange={e => set("signatory", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Title</label>
                <input type="text" value={form.signatoryTitle} onChange={e => set("signatoryTitle", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Email</label>
                <input type="email" value={form.signatoryEmail} onChange={e => set("signatoryEmail", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            {/* Final gate status */}
            <div className="mt-6 p-4 rounded-lg border-2 border-dashed border-slate-300">
              <h3 className="text-sm font-bold text-slate-700 mb-2">Stage 0 Gate Check — Ready to Submit?</h3>
              <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                {[
                  ["Brand selected", gate0.brandId], ["Executive Sponsor", gate0.executiveSponsor],
                  ["Factory assigned", gate0.factoryId], ["Garment SKU defined", gate0.garmentSku],
                  ["Launch season set", gate0.targetLaunchSeason], ["Volume forecasted", gate0.volume],
                ].map(([label, pass]) => (
                  <div key={label as string} className={`flex items-center gap-1 ${pass ? "text-green-600" : "text-red-500"}`}>
                    {pass ? "✓" : "✗"} {label}
                  </div>
                ))}
              </div>
              {!gate0Pass && <p className="text-xs text-red-500">Complete all gate requirements before submitting. No lab work permitted without Stage 0 qualification.</p>}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-6 pt-4 border-t">
          <button type="button" onClick={() => step > 0 ? setStep(step - 1) : router.push("/sow")}
            className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-300">
            {step === 0 ? "Cancel" : "← Previous"}
          </button>
          {step < 5 ? (
            <button type="button" onClick={() => setStep(step + 1)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">
              Next →
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={saving || !gate0Pass}
              className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? "Creating SOW..." : "Create SOW & Pass Stage 0"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
