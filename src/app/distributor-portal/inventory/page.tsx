// @ts-nocheck
"use client";

import { useAuth } from "@/lib/AuthContext";
import { useI18n } from "@/i18n";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function DistributorInventoryPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const tx = t.distributorPortal.inventoryView;
  const router = useRouter();
  const [inventory, setInventory] = useState<any>(null);
  const [pricing, setPricing] = useState<any[]>([]);
  const [factories, setFactories] = useState<any[]>([]);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPricingForm, setShowPricingForm] = useState(false);
  const [editInventory, setEditInventory] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Inventory edit form
  const [invForm, setInvForm] = useState({
    fuzeStockLiters: "",
    fuzeStockBottles: "",
    hangtagStock: "",
    reorderPointLiters: "",
  });

  // Pricing form
  const [pricingForm, setPricingForm] = useState({
    factoryId: "",
    country: "",
    region: "",
    pricePerLiter: "36",
    currency: "USD",
    hangtagPricePerUnit: "0.15",
    leadTimeDays: "",
    isDefault: false,
  });

  const isDistributor = user?.role === "DISTRIBUTOR_USER";
  const isAdmin = ["ADMIN", "EMPLOYEE"].includes(user?.role || "");

  useEffect(() => {
    if (!isDistributor && !isAdmin) {
      router.push("/dashboard");
      return;
    }
    loadData();
  }, [user]);

  async function loadData() {
    try {
      const [invRes, pricingRes] = await Promise.all([
        fetch("/api/distributor-portal/inventory"),
        fetch("/api/distributor-portal/pricing"),
      ]);
      const invData = await invRes.json();
      const pricingData = await pricingRes.json();

      if (invData.ok) {
        setInventory(invData.inventory);
        setPendingOrders(invData.pendingOrders || []);
        setInvForm({
          fuzeStockLiters: String(invData.inventory?.fuzeStockLiters || 0),
          fuzeStockBottles: String(invData.inventory?.fuzeStockBottles || 0),
          hangtagStock: String(invData.inventory?.hangtagStock || 0),
          reorderPointLiters: String(invData.inventory?.reorderPointLiters || 100),
        });
      }
      if (pricingData.ok) {
        setPricing(pricingData.pricing || []);
        setFactories(pricingData.factories || []);
      }
    } catch (e) {
      console.error("Failed to load data:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateInventory(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/distributor-portal/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invForm),
      });
      const data = await res.json();
      if (data.ok) {
        setInventory(data.inventory);
        setEditInventory(false);
        setSuccess("Inventory updated successfully");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.error || "Failed to update");
      }
    } catch (e: any) {
      setError(e.message || "Error updating inventory");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreatePricing(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/distributor-portal/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pricingForm),
      });
      const data = await res.json();
      if (data.ok) {
        setPricing([data.tier, ...pricing]);
        setShowPricingForm(false);
        setPricingForm({ factoryId: "", country: "", region: "", pricePerLiter: "36", currency: "USD", hangtagPricePerUnit: "0.15", leadTimeDays: "", isDefault: false });
        setSuccess("Pricing tier created");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.error || "Failed to create pricing");
      }
    } catch (e: any) {
      setError(e.message || "Error creating pricing");
    } finally {
      setSaving(false);
    }
  }

  async function togglePricingActive(tierId: string, active: boolean) {
    try {
      const res = await fetch("/api/distributor-portal/pricing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierId, active }),
      });
      const data = await res.json();
      if (data.ok) {
        setPricing(pricing.map((p) => (p.id === tierId ? data.tier : p)));
      }
    } catch (e) {
      console.error("Toggle failed:", e);
    }
  }

  async function deletePricingTier(tierId: string, label: string) {
    if (
      !confirm(
        `Delete pricing tier "${label}"?\n\nThis permanently removes the tier. Cannot be undone. ` +
          `If you just want to stop using it temporarily, click Deactivate instead.`,
      )
    ) {
      return;
    }
    try {
      const res = await fetch(
        `/api/distributor-portal/pricing?tierId=${encodeURIComponent(tierId)}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (data.ok) {
        setPricing(pricing.filter((p) => p.id !== tierId));
        setSuccess("Pricing tier deleted");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.error || "Failed to delete tier");
      }
    } catch (e: any) {
      setError(e?.message || "Error deleting tier");
    }
  }

  function formatCurrency(amount: number, currency = "USD") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const stockLiters = inventory?.fuzeStockLiters || 0;
  const stockBottles = inventory?.fuzeStockBottles || 0;
  const threshold = inventory?.reorderPointLiters || 100;
  const isLow = stockLiters < threshold;

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{tx.pageTitle}</h1>
          <p className="text-slate-500 mt-1">{tx.pageSubtitle}</p>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <button onClick={() => setError("")} className="ml-2 font-bold">✕</button>
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {success}
        </div>
      )}

      {/* ═══ INVENTORY SECTION ═══ */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">FUZE Stock Levels</h2>
          <button
            onClick={() => setEditInventory(!editInventory)}
            className="px-4 py-2 text-sm font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          >
            {editInventory ? "Cancel" : "Update Stock"}
          </button>
        </div>

        {/* Stock KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className={`rounded-xl border p-5 ${isLow ? "bg-red-50 border-red-200" : "bg-white border-slate-200"}`}>
            <p className="text-xs text-slate-500 font-medium mb-1">FUZE Stock</p>
            <p className={`text-3xl font-bold ${isLow ? "text-red-700" : "text-slate-900"}`}>{stockLiters.toLocaleString()}L</p>
            {isLow && <p className="text-xs text-red-600 font-medium mt-1">Below reorder threshold</p>}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs text-slate-500 font-medium mb-1">Bottles (19L)</p>
            <p className="text-3xl font-bold text-slate-900">{stockBottles}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs text-slate-500 font-medium mb-1">Hangtag Stock</p>
            <p className="text-3xl font-bold text-slate-900">{(inventory?.hangtagStock || 0).toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-xs text-slate-500 font-medium mb-1">Reorder At</p>
            <p className="text-3xl font-bold text-slate-900">{threshold}L</p>
            <p className="text-xs text-slate-400 mt-1">
              Last updated: {inventory?.lastStockUpdate ? new Date(inventory.lastStockUpdate).toLocaleDateString() : "Never"}
            </p>
          </div>
        </div>

        {/* Edit Inventory Form */}
        {editInventory && (
          <form onSubmit={handleUpdateInventory} className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
            <h3 className="font-semibold text-slate-900 mb-4">Update Stock Levels</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">FUZE Stock (liters)</label>
                <input
                  type="number"
                  value={invForm.fuzeStockLiters}
                  onChange={(e) => setInvForm({ ...invForm, fuzeStockLiters: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Bottles (19L)</label>
                <input
                  type="number"
                  value={invForm.fuzeStockBottles}
                  onChange={(e) => setInvForm({ ...invForm, fuzeStockBottles: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Hangtag Stock</label>
                <input
                  type="number"
                  value={invForm.hangtagStock}
                  onChange={(e) => setInvForm({ ...invForm, hangtagStock: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reorder Threshold (L)</label>
                <input
                  type="number"
                  value={invForm.reorderPointLiters}
                  onChange={(e) => setInvForm({ ...invForm, reorderPointLiters: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] outline-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-[#00b4c3] text-white rounded-lg font-semibold hover:bg-[#009aa8] transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setEditInventory(false)}
                className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Pending Orders (incoming stock) */}
        {pendingOrders.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <h3 className="font-semibold text-blue-900 mb-3">Pending Fulfillment ({pendingOrders.length} orders)</h3>
            <div className="space-y-2">
              {pendingOrders.map((o) => (
                <div key={o.id} className="flex items-center justify-between text-sm">
                  <span className="text-blue-800">
                    {o.orderNumber} — {o.factory?.name}
                  </span>
                  <span className="text-blue-700 font-semibold">
                    {o.volumeLiters ? `${o.volumeLiters}L` : ""}
                    {o.hangtagQty ? `${o.hangtagQty} tags` : ""}
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-blue-200 text-blue-800 text-xs">{o.status}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══ PRICING SECTION ═══ */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">Pricing Tiers</h2>
          <button
            onClick={() => setShowPricingForm(!showPricingForm)}
            className="px-4 py-2 text-sm font-semibold bg-[#00b4c3] text-white rounded-lg hover:bg-[#009aa8] transition-colors"
          >
            + Add Pricing Tier
          </button>
        </div>

        <p className="text-sm text-slate-500 mb-4">
          Pricing is resolved in order of specificity: factory-specific &gt; country &gt; region &gt; default.
          When a factory places an order, the system automatically finds the best matching price.
        </p>

        {/* New Pricing Form */}
        {showPricingForm && (
          <form onSubmit={handleCreatePricing} className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
            <h3 className="font-semibold text-slate-900 mb-4">New Pricing Tier</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Factory (optional)</label>
                <select
                  value={pricingForm.factoryId}
                  onChange={(e) => setPricingForm({ ...pricingForm, factoryId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] outline-none"
                >
                  <option value="">All factories (default pricing)</option>
                  {factories.filter((f: any) => f.assigned).length > 0 && (
                    <optgroup label="Your Factories">
                      {factories.filter((f: any) => f.assigned).map((f: any) => (
                        <option key={f.id} value={f.id}>{f.name} ({f.country})</option>
                      ))}
                    </optgroup>
                  )}
                  {factories.filter((f: any) => !f.assigned).length > 0 && (
                    <optgroup label="Other Factories">
                      {factories.filter((f: any) => !f.assigned).map((f: any) => (
                        <option key={f.id} value={f.id}>{f.name} ({f.country})</option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <p className="text-xs text-slate-400 mt-1">Leave blank for country/region/default pricing</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Country (optional)</label>
                <input
                  type="text"
                  value={pricingForm.country}
                  onChange={(e) => setPricingForm({ ...pricingForm, country: e.target.value })}
                  placeholder="e.g. Thailand"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Region (optional)</label>
                <input
                  type="text"
                  value={pricingForm.region}
                  onChange={(e) => setPricingForm({ ...pricingForm, region: e.target.value })}
                  placeholder="e.g. Southeast Asia"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Price per Liter</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={pricingForm.pricePerLiter}
                    onChange={(e) => setPricingForm({ ...pricingForm, pricePerLiter: e.target.value })}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] outline-none"
                    required
                  />
                  <select
                    value={pricingForm.currency}
                    onChange={(e) => setPricingForm({ ...pricingForm, currency: e.target.value })}
                    className="w-24 px-2 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] outline-none"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="TWD">TWD</option>
                    <option value="THB">THB</option>
                    <option value="CNY">CNY</option>
                    <option value="TRY">TRY</option>
                    <option value="VND">VND</option>
                    <option value="BDT">BDT</option>
                    <option value="INR">INR</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Hangtag Price/Unit</label>
                <input
                  type="number"
                  step="0.01"
                  value={pricingForm.hangtagPricePerUnit}
                  onChange={(e) => setPricingForm({ ...pricingForm, hangtagPricePerUnit: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Lead Time (days)</label>
                <input
                  type="number"
                  value={pricingForm.leadTimeDays}
                  onChange={(e) => setPricingForm({ ...pricingForm, leadTimeDays: e.target.value })}
                  placeholder="e.g. 14"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#00b4c3] outline-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 mt-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={pricingForm.isDefault}
                  onChange={(e) => setPricingForm({ ...pricingForm, isDefault: e.target.checked })}
                  className="rounded"
                />
                <span className="text-slate-700">Set as default pricing</span>
              </label>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-[#00b4c3] text-white rounded-lg font-semibold hover:bg-[#009aa8] transition-colors disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create Tier"}
              </button>
              <button
                type="button"
                onClick={() => setShowPricingForm(false)}
                className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Pricing Tiers List */}
        {pricing.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <p className="text-3xl mb-3">💰</p>
            <h3 className="font-semibold text-slate-900 mb-2">No pricing tiers yet</h3>
            <p className="text-slate-500 text-sm mb-4">Create pricing tiers so factories get auto-generated quotes when they order.</p>
            <button
              onClick={() => setShowPricingForm(true)}
              className="px-5 py-2.5 bg-[#00b4c3] text-white rounded-lg font-semibold hover:bg-[#009aa8] transition-colors"
            >
              Create First Tier
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {pricing.map((tier) => (
              <div
                key={tier.id}
                className={`bg-white rounded-xl border p-5 ${tier.active ? "border-slate-200" : "border-slate-200 opacity-60"}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      {tier.isDefault && (
                        <span className="px-2 py-0.5 bg-[#00b4c3] text-white text-xs font-bold rounded-full">DEFAULT</span>
                      )}
                      {tier.factory?.name && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                          Factory: {tier.factory.name}
                        </span>
                      )}
                      {tier.country && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                          Country: {tier.country}
                        </span>
                      )}
                      {tier.region && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                          Region: {tier.region}
                        </span>
                      )}
                      {!tier.active && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs font-medium rounded-full">Inactive</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600 mt-2">
                      <span><strong>{formatCurrency(tier.pricePerLiter, tier.currency)}</strong>/liter</span>
                      {tier.hangtagPricePerUnit > 0 && (
                        <span>{formatCurrency(tier.hangtagPricePerUnit, tier.currency)}/hangtag</span>
                      )}
                      {tier.leadTimeDays && <span>{tier.leadTimeDays} day lead time</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => togglePricingActive(tier.id, !tier.active)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        tier.active
                          ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                          : "bg-green-50 text-green-700 hover:bg-green-100"
                      }`}
                    >
                      {tier.active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={() => {
                        const label =
                          tier.factory?.name ||
                          tier.country ||
                          tier.region ||
                          (tier.isDefault ? "Default tier" : "this tier");
                        deletePricingTier(tier.id, label);
                      }}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                      title="Permanently delete this tier"
                    >
                      🗑 Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
