"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

/* ── Test Request Modal (shared with brand portal) ── */
function TestRequestModal({ fabric, onClose, onSuccess }: { fabric: any; onClose: () => void; onSuccess: (result: any) => void }) {
  const [labs, setLabs] = useState<any[]>([]);
  const [selectedLab, setSelectedLab] = useState("");
  const [selectedTests, setSelectedTests] = useState<Record<string, boolean>>({});
  const [rushTests, setRushTests] = useState<Record<string, boolean>>({});
  const [instructions, setInstructions] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/brand-portal/test-request")
      .then((r) => r.json())
      .then((j) => { if (j.ok) setLabs(j.labs); })
      .finally(() => setLoading(false));
  }, []);

  const currentLab = labs.find((l) => l.id === selectedLab);
  const services = currentLab?.services || [];
  const toggleTest = (m: string) => setSelectedTests((p) => ({ ...p, [m]: !p[m] }));
  const toggleRush = (m: string) => setRushTests((p) => ({ ...p, [m]: !p[m] }));
  const selectedServices = services.filter((s: any) => selectedTests[s.testMethod]);
  const totalCost = selectedServices.reduce((sum: number, s: any) => sum + (s.priceUSD || 0) + (rushTests[s.testMethod] ? (s.rushPriceUSD || 0) : 0), 0);
  const maxDays = selectedServices.reduce((max: number, s: any) => Math.max(max, rushTests[s.testMethod] ? (s.rushDays || s.turnaroundDays || 0) : (s.turnaroundDays || 0)), 0);

  const handleSubmit = async () => {
    if (!selectedLab) return setError("Please select a laboratory");
    if (selectedServices.length === 0) return setError("Please select at least one test");
    setSubmitting(true); setError("");
    try {
      const res = await fetch("/api/brand-portal/test-request", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fabricId: fabric.id, labId: selectedLab, priority,
          specialInstructions: instructions || null,
          services: selectedServices.map((s: any) => ({ testType: s.testType, testMethod: s.testMethod, quantity: 1, rush: rushTests[s.testMethod] || false })),
        }),
      });
      const j = await res.json();
      if (j.ok) onSuccess(j.testRequest);
      else setError(j.error || "Failed to submit");
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-[#00b4c3] to-emerald-500 p-6 rounded-t-2xl text-white">
          <h2 className="text-xl font-black">Request Testing</h2>
          <p className="text-white/80 text-sm mt-1">FUZE {fabric.fuzeNumber} — {fabric.customerCode || fabric.construction || "Fabric"}</p>
        </div>
        <div className="p-6">
          {loading ? <div className="text-center py-8 text-slate-400">Loading available tests...</div> : (
            <>
              {/* Lab Selection */}
              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Select Laboratory</label>
                <select value={selectedLab} onChange={(e) => { setSelectedLab(e.target.value); setSelectedTests({}); setRushTests({}); }}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm font-semibold text-slate-900 bg-white focus:border-[#00b4c3] focus:outline-none">
                  <option value="">— Choose a laboratory —</option>
                  {labs.map((lab: any) => (
                    <option key={lab.id} value={lab.id}>{lab.name} — {[lab.city, lab.country].filter(Boolean).join(", ")}{lab.services.length > 0 ? ` (${lab.services.length} tests)` : " — Contact for pricing"}</option>
                  ))}
                </select>
              </div>
              {/* Test Selection */}
              {currentLab && services.length > 0 && (
                <div className="mb-6">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Select Tests</label>
                  <div className="space-y-2">
                    {services.map((svc: any) => (
                      <div key={svc.testMethod} className={`rounded-xl border-2 transition-all ${selectedTests[svc.testMethod] ? "border-[#00b4c3] bg-[#00b4c3]/5" : "border-slate-200"}`}>
                        <button onClick={() => toggleTest(svc.testMethod)} className="w-full p-4 text-left">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-[#00b4c3] bg-[#00b4c3]/10 px-2 py-0.5 rounded">{svc.testMethod}</span>
                                <span className="font-bold text-sm text-slate-900">{svc.testType.replace(/_/g, " ")}</span>
                                {svc.preferred && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded">★ {svc.preferredNote || "Recommended"}</span>}
                              </div>
                              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{svc.description}</p>
                            </div>
                            <div className="text-right ml-4 shrink-0">
                              <div className="text-sm font-black text-slate-900">${svc.priceUSD}</div>
                              <div className="text-[10px] text-slate-500">{svc.turnaroundDays} days</div>
                            </div>
                          </div>
                        </button>
                        {selectedTests[svc.testMethod] && svc.rushPriceUSD && (
                          <div className="px-4 pb-3">
                            <button onClick={() => toggleRush(svc.testMethod)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${rushTests[svc.testMethod] ? "bg-amber-100 text-amber-700 border border-amber-300" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                              ⚡ Rush (+${svc.rushPriceUSD}, {svc.rushDays} days)
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {currentLab && services.length === 0 && <div className="text-center py-6 text-slate-400 text-sm">No test services configured for this lab yet.</div>}
              {/* Summary + Submit */}
              {selectedServices.length > 0 && (
                <>
                  <div className="mb-4">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Priority</label>
                    <div className="flex gap-2">
                      {["NORMAL", "HIGH", "URGENT"].map((p) => (
                        <button key={p} onClick={() => setPriority(p)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${priority === p ? (p === "URGENT" ? "bg-red-100 text-red-700" : p === "HIGH" ? "bg-amber-100 text-amber-700" : "bg-slate-900 text-white") : "bg-slate-100 text-slate-500"}`}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mb-6">
                    <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
                      placeholder="Special instructions (optional)..." />
                  </div>
                  <div className="bg-gradient-to-r from-slate-50 to-[#00b4c3]/5 rounded-xl border p-4 mb-6">
                    <div className="font-black text-lg text-slate-900">${totalCost}</div>
                    <div className="text-[10px] text-slate-500">Est. {maxDays} business days · {selectedServices.length} test{selectedServices.length !== 1 ? "s" : ""}</div>
                  </div>
                </>
              )}
              {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
              <div className="flex gap-3">
                {selectedServices.length > 0 && (
                  <button onClick={handleSubmit} disabled={submitting}
                    className="flex-1 px-6 py-3 bg-[#00b4c3] text-white rounded-xl text-sm font-black hover:bg-[#009aa8] disabled:opacity-50 shadow-lg shadow-[#00b4c3]/30">
                    {submitting ? "Submitting..." : `Submit Request · $${totalCost}`}
                  </button>
                )}
                <button onClick={onClose} className="px-4 py-3 text-sm text-slate-600 border border-slate-300 rounded-xl hover:bg-slate-50">Cancel</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface Fabric {
  id: string;
  fuzeNumber: number | null;
  customerCode?: string;
  factoryCode?: string;
  note?: string;
  weightGsm?: number;
  widthInches?: number;
  construction?: string;
  yarnType?: string;
  createdAt: string;
}

export default function FactoryFabricsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [testingFabric, setTestingFabric] = useState<any>(null);
  const [success, setSuccess] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Tab view
  const [activeTab, setActiveTab] = useState<"fabrics" | "submissions">("fabrics");
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);

  // Brand Fabric Lookup
  const [showBrandLookup, setShowBrandLookup] = useState(false);
  const [brandSearch, setBrandSearch] = useState("");
  const [fuzeNumSearch, setFuzeNumSearch] = useState("");
  const [brandResults, setBrandResults] = useState<any[]>([]);
  const [brandSearching, setBrandSearching] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);

  const handleBrandLookup = async () => {
    if (!brandSearch && !fuzeNumSearch) return;
    setBrandSearching(true);
    try {
      const params = new URLSearchParams();
      if (brandSearch) params.set("brand", brandSearch);
      if (fuzeNumSearch) params.set("fuzeNumber", fuzeNumSearch);
      const res = await fetch(`/api/factory-portal/brand-fabric-lookup?${params}`);
      const data = await res.json();
      if (data.ok) {
        setBrandResults(data.fabrics);
      } else {
        setError(data.error || "Lookup failed");
      }
    } catch {
      setError("Brand lookup failed");
    } finally {
      setBrandSearching(false);
    }
  };

  const handleLinkFabric = async (fabricId: string) => {
    setLinkingId(fabricId);
    try {
      const res = await fetch("/api/factory-portal/brand-fabric-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fabricId }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess(data.message);
        setBrandResults((prev) => prev.map((f) => f.id === fabricId ? { ...f, alreadyLinked: true } : f));
        // Refresh factory fabrics list
        const qs = search ? `?search=${encodeURIComponent(search)}` : "";
        const fabRes = await fetch(`/api/factory-portal/fabrics${qs}`);
        const fabData = await fabRes.json();
        if (fabData.ok) setFabrics(fabData.fabrics);
        setTimeout(() => setSuccess(""), 5000);
      } else {
        setError(data.error || "Failed to link fabric");
      }
    } catch {
      setError("Failed to link fabric");
    } finally {
      setLinkingId(null);
    }
  };

  useEffect(() => {
    if (user?.role !== "FACTORY_USER" && user?.role !== "FACTORY_MANAGER") {
      router.push("/dashboard");
      return;
    }

    const loadFabrics = async () => {
      try {
        const qs = search ? `?search=${encodeURIComponent(search)}` : "";
        const res = await fetch(`/api/factory-portal/fabrics${qs}`);
        const data = await res.json();
        if (data.ok) {
          setFabrics(data.fabrics);
        } else {
          setError(data.error || "Failed to load fabrics");
        }
      } catch (e) {
        setError("Failed to load fabrics");
      } finally {
        setLoading(false);
      }
    };

    const loadSubmissions = async () => {
      setLoadingSubs(true);
      try {
        const res = await fetch("/api/factory-portal/submissions");
        const data = await res.json();
        if (data.ok) setSubmissions(data.submissions || []);
      } catch { /* quiet */ }
      finally { setLoadingSubs(false); }
    };

    loadFabrics();
    loadSubmissions();
  }, [user, router, search]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleDelete = async (fabricId: string) => {
    if (!confirm("Delete this fabric? This cannot be undone.")) return;
    setDeletingId(fabricId);
    try {
      const res = await fetch(`/api/fabrics/${fabricId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        setFabrics((prev) => prev.filter((f) => f.id !== fabricId));
        setSuccess("Fabric deleted successfully.");
        setTimeout(() => setSuccess(""), 5000);
      } else {
        setError(data.error || "Failed to delete fabric");
      }
    } catch {
      setError("Failed to delete fabric");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Link href="/factory-portal" className="hover:text-[#00b4c3]">Factory Portal</Link>
            <span>/</span>
            <span className="text-slate-800 font-medium">My Fabrics</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">My Fabrics</h1>
          <p className="text-sm text-slate-500 mt-1">
            {fabrics.length} fabric{fabrics.length !== 1 ? "s" : ""} registered for FUZE treatment
          </p>
        </div>
        <Link href="/factory-portal/intake"
          className="px-4 py-2.5 bg-gradient-to-r from-[#00b4c3] to-[#009ba8] text-white rounded-lg font-semibold text-sm hover:shadow-lg hover:shadow-[#00b4c3]/30 transition-all">
          + Add Fabric
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setActiveTab("fabrics")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === "fabrics" ? "bg-slate-900 text-white" : "bg-white border border-slate-300 text-slate-600 hover:bg-slate-50"}`}>
          All Fabrics ({fabrics.length})
        </button>
        <button onClick={() => setActiveTab("submissions")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === "submissions" ? "bg-slate-900 text-white" : "bg-white border border-slate-300 text-slate-600 hover:bg-slate-50"}`}>
          Submissions ({submissions.length})
        </button>
      </div>

      {/* Search — only show on fabrics tab */}
      {activeTab === "fabrics" && (fabrics.length > 0 || search) ? (
        <div className="mb-6">
          <div className="relative max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by code, construction, FUZE number..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
            />
          </div>
        </div>
      ) : null}

      {activeTab === "fabrics" && (<>
      {/* Brand Fabric Lookup */}
      <div className="mb-6">
        <button onClick={() => setShowBrandLookup(!showBrandLookup)}
          className="text-sm font-semibold text-[#0b3d5c] hover:text-[#00b4c3] flex items-center gap-2 transition-colors">
          <span>{showBrandLookup ? "▾" : "▸"}</span>
          Look Up Brand Fabric
        </button>
        {showBrandLookup && (
          <div className="mt-3 bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs text-slate-500 mb-3">Search for a fabric registered by a brand. If it matches, you can link it to your factory.</p>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-600 mb-1">Brand Name</label>
                <input type="text" value={brandSearch} onChange={(e) => setBrandSearch(e.target.value)}
                  placeholder="e.g., Notimid" onKeyDown={(e) => e.key === "Enter" && handleBrandLookup()}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none" />
              </div>
              <div className="w-40">
                <label className="block text-xs font-medium text-slate-600 mb-1">FUZE #</label>
                <input type="text" value={fuzeNumSearch} onChange={(e) => setFuzeNumSearch(e.target.value)}
                  placeholder="e.g., 2510" onKeyDown={(e) => e.key === "Enter" && handleBrandLookup()}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] outline-none" />
              </div>
              <button onClick={handleBrandLookup} disabled={brandSearching || (!brandSearch && !fuzeNumSearch)}
                className="px-5 py-2 bg-[#0b3d5c] text-white rounded-lg text-sm font-semibold hover:bg-[#0a3450] disabled:opacity-50 transition-colors whitespace-nowrap">
                {brandSearching ? "Searching..." : "Search"}
              </button>
            </div>
            {brandResults.length > 0 && (
              <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs">FUZE #</th>
                      <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs">Brand</th>
                      <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs">Brand Code</th>
                      <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs hidden sm:table-cell">Construction</th>
                      <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs hidden md:table-cell">Weight</th>
                      <th className="text-center px-3 py-2 font-semibold text-slate-600 text-xs">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {brandResults.map((f) => (
                      <tr key={f.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono font-bold text-[#00b4c3]">FUZE-{f.fuzeNumber}</td>
                        <td className="px-3 py-2 text-slate-700">{f.brandName}</td>
                        <td className="px-3 py-2 text-slate-600">{f.customerCode || "—"}</td>
                        <td className="px-3 py-2 text-slate-600 hidden sm:table-cell truncate max-w-[150px]">{f.construction || "—"}</td>
                        <td className="px-3 py-2 text-slate-600 hidden md:table-cell">{f.weightGsm ? `${f.weightGsm} GSM` : "—"}</td>
                        <td className="px-3 py-2 text-center">
                          {f.alreadyLinked ? (
                            <span className="text-xs text-emerald-600 font-semibold">✓ Linked</span>
                          ) : (
                            <button onClick={() => handleLinkFabric(f.id)} disabled={linkingId === f.id}
                              className="px-3 py-1 bg-[#00b4c3] text-white rounded text-xs font-bold hover:bg-[#009aa8] disabled:opacity-50">
                              {linkingId === f.id ? "..." : "Link to Factory"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {brandResults.length === 0 && (brandSearch || fuzeNumSearch) && !brandSearching && (
              <p className="mt-3 text-xs text-slate-400">No brand fabrics found. Check the brand name or FUZE number and try again.</p>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{success}</div>
      )}

      {/* Fabrics Table */}
      {fabrics.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-slate-500 mb-2">
            {search ? "No fabrics match your search" : "No fabrics yet"}
          </p>
          {search ? (
            <button
              onClick={() => { setSearchInput(""); setSearch(""); }}
              className="text-[#00b4c3] hover:underline font-medium text-sm"
            >
              Clear search
            </button>
          ) : (
            <Link href="/factory-portal/intake"
              className="text-[#00b4c3] hover:underline font-medium text-sm">
              Submit your first fabric &rarr;
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">FUZE #</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Factory Code</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Brand Code</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700 hidden sm:table-cell">Construction</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700 hidden md:table-cell">Weight</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700 hidden lg:table-cell">Added</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-700">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fabrics.map(fabric => (
                <tr key={fabric.id}
                    className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono font-bold text-[#00b4c3] cursor-pointer hover:underline" onClick={() => router.push(`/fabrics/${fabric.id}`)}>FUZE-{fabric.fuzeNumber}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{fabric.factoryCode || "—"}</td>
                  <td className="px-4 py-3 text-slate-700">{fabric.customerCode || "—"}</td>
                  <td className="px-4 py-3 text-slate-600 hidden sm:table-cell truncate max-w-[200px]">
                    {fabric.construction || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600 hidden md:table-cell">
                    {fabric.weightGsm ? `${fabric.weightGsm} GSM` : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell">
                    {new Date(fabric.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setTestingFabric(fabric)}
                        className="px-3 py-1.5 bg-[#00b4c3] text-white rounded-lg text-[11px] font-bold hover:bg-[#009aa8] shadow-sm transition-all whitespace-nowrap"
                      >
                        🧪 Test
                      </button>
                      <button
                        onClick={() => router.push(`/fabrics/${fabric.id}`)}
                        className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[11px] font-bold hover:bg-slate-200 transition-all whitespace-nowrap"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleDelete(fabric.id)}
                        disabled={deletingId === fabric.id}
                        className="px-2 py-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg text-[11px] transition-all disabled:opacity-50"
                        title="Delete fabric"
                      >
                        {deletingId === fabric.id ? "..." : "✕"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      </>)}

      {/* Submissions Tab */}
      {activeTab === "submissions" && (
        <div>
          {loadingSubs ? (
            <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" /></div>
          ) : submissions.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
              <p className="text-slate-500 mb-2">No submissions yet</p>
              <Link href="/factory-portal/intake" className="text-[#00b4c3] hover:underline font-medium text-sm">Submit a fabric →</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {submissions.map((sub: any) => (
                <div key={sub.id} onClick={() => router.push(`/fabrics/${sub.fabric.id}`)}
                  className="bg-white border border-slate-200 rounded-xl p-4 hover:border-[#00b4c3] hover:shadow-md transition-all cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-mono font-bold text-[#00b4c3]">FUZE-{sub.fabric?.fuzeNumber}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                          sub.status === "COMPLETE" || sub.status === "APPROVED" ? "bg-emerald-100 text-emerald-800" :
                          sub.status === "TESTING" ? "bg-purple-100 text-purple-800" :
                          sub.status === "IN_REVIEW" ? "bg-amber-100 text-amber-800" :
                          sub.status === "REJECTED" ? "bg-red-100 text-red-800" :
                          "bg-blue-100 text-blue-800"
                        }`}>
                          {sub.status}
                        </span>
                      </div>
                      <div className="text-sm text-slate-600">
                        {sub.fabric?.construction || sub.fabric?.note?.replace("Intake: ", "").split(" | ")[0] || "—"}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">Submitted {new Date(sub.createdAt).toLocaleDateString()}</div>
                      {sub.testResults && sub.testResults.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {sub.testResults.map((r: any, i: number) => (
                            <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{r.testType}: {r.status}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <svg className="w-5 h-5 text-slate-300 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Test Request Modal */}
      {testingFabric && (
        <TestRequestModal
          fabric={testingFabric}
          onClose={() => setTestingFabric(null)}
          onSuccess={(result) => {
            setTestingFabric(null);
            setSuccess(`Test request ${result.poNumber} submitted to ${result.labName}! Estimated cost: $${result.estimatedCost}. Your request is pending review.`);
            setTimeout(() => setSuccess(""), 8000);
          }}
        />
      )}
    </div>
  );
}
