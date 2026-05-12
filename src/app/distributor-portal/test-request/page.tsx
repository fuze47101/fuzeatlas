"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Fabric {
  id: string;
  fuzeNumber: number | null;
  customerCode: string | null;
  factoryCode: string | null;
  fabricCategory: string | null;
  color: string | null;
  construction: string | null;
  weightGsm: number | null;
  brand: { id: string; name: string } | null;
  factory: { id: string; name: string } | null;
}

interface LabService {
  id: string;
  testType: string;
  testMethod: string;
  description: string | null;
  priceUSD: number | null;
  turnaroundDays: number | null;
  rushPriceUSD: number | null;
  rushDays: number | null;
  preferred: boolean;
  preferredNote: string | null;
}

interface Lab {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  accreditations: string | null;
  services: LabService[];
}

export default function DistributorTestRequestPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [loadingFabrics, setLoadingFabrics] = useState(false);
  const [selectedFabric, setSelectedFabric] = useState<Fabric | null>(null);

  const [labs, setLabs] = useState<Lab[]>([]);
  const [loadingLabs, setLoadingLabs] = useState(false);
  const [selectedLab, setSelectedLab] = useState("");
  const [selectedTests, setSelectedTests] = useState<Record<string, boolean>>({});
  const [rushTests, setRushTests] = useState<Record<string, boolean>>({});

  // Tina's original ask: select factory THEN fabric. The fabric
  // picker now has an explicit factory dropdown above the text
  // search. Empty = show all (legacy behavior).
  const [factoryFilter, setFactoryFilter] = useState<string>("");
  const [factoryOptions, setFactoryOptions] = useState<
    Array<{ id: string; name: string; country: string | null; assigned: boolean }>
  >([]);
  const [instructions, setInstructions] = useState("");
  const [priority, setPriority] = useState("NORMAL");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{
    poNumber: string;
    estimatedCost: number;
    labName?: string;
  } | null>(null);

  // Phase 15 NEED-FB-4 (Tina Dist ticket cmp1u686c) — inline "+ New
  // fabric" so distributors can apply for a test against a mill that
  // hasn't done its first formal fabric submission yet. The created
  // Fabric + FabricSubmission row carries both factoryId + distributorId
  // so it shows up under the mill's portfolio AND the distributor's.
  const [showNewFabric, setShowNewFabric] = useState(false);
  const [creatingFabric, setCreatingFabric] = useState(false);
  const [newFabric, setNewFabric] = useState({
    factoryId: "",
    customerReference: "",
    customerCode: "",
    factoryCode: "",
    construction: "",
    color: "",
    yarnType: "",
    weightGsm: "",
    fabricCategory: "",
  });

  async function handleCreateNewFabric() {
    if (!newFabric.factoryId) {
      setError("Pick a mill before adding a fabric");
      return;
    }
    if (
      !newFabric.customerReference &&
      !newFabric.customerCode &&
      !newFabric.factoryCode &&
      !newFabric.construction &&
      !newFabric.color
    ) {
      setError(
        "Provide at least one identifier — customer ref, code, construction, or color",
      );
      return;
    }
    setCreatingFabric(true);
    setError("");
    try {
      const res = await fetch("/api/distributor-portal/fabrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          factoryId: newFabric.factoryId,
          customerReference: newFabric.customerReference || undefined,
          customerCode: newFabric.customerCode || undefined,
          factoryCode: newFabric.factoryCode || undefined,
          construction: newFabric.construction || undefined,
          color: newFabric.color || undefined,
          yarnType: newFabric.yarnType || undefined,
          weightGsm: newFabric.weightGsm || undefined,
          fabricCategory: newFabric.fabricCategory || undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setError(j.error || `HTTP ${res.status}`);
        return;
      }
      const factoryName =
        factoryOptions.find((f) => f.id === newFabric.factoryId)?.name || null;
      setSelectedFabric({
        id: j.fabric.id,
        fuzeNumber: j.fabric.fuzeNumber ?? null,
        customerCode: j.fabric.customerCode ?? null,
        factoryCode: j.fabric.factoryCode ?? null,
        fabricCategory: j.fabric.fabricCategory ?? null,
        color: j.fabric.color ?? null,
        construction: j.fabric.construction ?? null,
        weightGsm: j.fabric.weightGsm ?? null,
        brand: null,
        factory: factoryName ? { id: newFabric.factoryId, name: factoryName } : null,
      });
      setShowNewFabric(false);
      setNewFabric({
        factoryId: "",
        customerReference: "",
        customerCode: "",
        factoryCode: "",
        construction: "",
        color: "",
        yarnType: "",
        weightGsm: "",
        fabricCategory: "",
      });
    } catch (e: any) {
      setError(e?.message || "Failed to create fabric");
    } finally {
      setCreatingFabric(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    if (user.role !== "DISTRIBUTOR_USER" && user.role !== "ADMIN" && user.role !== "EMPLOYEE") {
      router.push("/dashboard");
      return;
    }
    setLoadingLabs(true);
    fetch("/api/distributor-portal/test-request")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          setLabs(j.labs);
          const fuze = j.labs.find((l: Lab) => l.name.toLowerCase().includes("fuze"));
          if (fuze) setSelectedLab(fuze.id);
        } else {
          setError(j.error || "Failed to load labs");
        }
      })
      .finally(() => setLoadingLabs(false));
  }, [user, router]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (!user) return;
    setLoadingFabrics(true);
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (factoryFilter) params.set("factoryId", factoryFilter);
    fetch(`/api/distributor-portal/fabric-search?${params.toString()}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setFabrics(j.fabrics);
        else setError(j.error || "Failed to search fabrics");
      })
      .finally(() => setLoadingFabrics(false));
  }, [user, search, factoryFilter]);

  // Load factory options for the dropdown — reuse the pricing
  // endpoint which already returns the distributor's factory list
  // with assigned/coverage scoring.
  useEffect(() => {
    if (!user) return;
    fetch("/api/distributor-portal/pricing")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok && Array.isArray(j.factories)) {
          setFactoryOptions(j.factories);
        }
      })
      .catch(() => {});
  }, [user]);

  const currentLab = labs.find((l) => l.id === selectedLab);
  const services = currentLab?.services || [];
  const selectedSvcRows = services.filter((s) => selectedTests[s.testMethod]);
  const totalCost = selectedSvcRows.reduce(
    (sum, s) => sum + (s.priceUSD || 0) + (rushTests[s.testMethod] ? s.rushPriceUSD || 0 : 0),
    0,
  );

  const submit = async () => {
    if (!selectedFabric) return setError("Please select a fabric");
    if (!selectedLab) return setError("Please select a lab");
    if (selectedSvcRows.length === 0) return setError("Please select at least one test");
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/distributor-portal/test-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fabricId: selectedFabric.id,
          labId: selectedLab,
          priority,
          specialInstructions: instructions || null,
          services: selectedSvcRows.map((s) => ({
            testType: s.testType,
            testMethod: s.testMethod,
            quantity: 1,
            rush: !!rushTests[s.testMethod],
          })),
        }),
      });
      const j = await res.json();
      if (j.ok) {
        setSuccess({
          poNumber: j.testRequest.poNumber,
          estimatedCost: j.testRequest.estimatedCost,
          labName: j.testRequest.labName,
        });
        setSelectedFabric(null);
        setSelectedTests({});
        setRushTests({});
        setInstructions("");
      } else {
        setError(j.error || "Failed to submit test request");
      }
    } catch (e: any) {
      setError(e.message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/distributor-portal" className="hover:text-[#00b4c3]">
            Distributor Portal
          </Link>
          <span>/</span>
          <span className="text-slate-800 font-medium">Apply for Test</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">Apply for Test (ICP / AM / Other)</h1>
        <p className="text-sm text-slate-500 mt-1">
          Submit ICP, antibacterial, antifungal or other lab tests on behalf of one of your
          customers
        </p>
      </div>

      {success ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 mb-6">
          <h2 className="font-bold text-emerald-900 mb-1">Test request submitted</h2>
          <p className="text-sm text-emerald-800">
            PO <span className="font-mono font-bold">{success.poNumber}</span> sent to{" "}
            <span className="font-medium">{success.labName || "lab"}</span>. Estimated cost{" "}
            <span className="font-bold">${success.estimatedCost.toLocaleString()}</span>.
          </p>
          <button
            onClick={() => setSuccess(null)}
            className="mt-3 px-4 py-2 bg-[#00b4c3] hover:bg-[#009ba8] text-white rounded-lg text-sm font-semibold transition-colors"
          >
            Submit another
          </button>
        </div>
      ) : null}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Step 1: Pick a fabric */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-slate-900">1. Choose fabric</h2>
          {!selectedFabric && !showNewFabric && factoryOptions.some((f) => f.assigned) && (
            <button
              onClick={() => setShowNewFabric(true)}
              className="text-xs px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded font-bold border border-emerald-200"
              title="Onboard a fabric for a mill before they're in the portal"
            >
              + New fabric
            </button>
          )}
        </div>

        {showNewFabric && (
          <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-emerald-900 text-sm">
                Onboard fabric for a mill
              </h3>
              <button
                onClick={() => setShowNewFabric(false)}
                className="text-xs text-slate-500 hover:text-slate-800 underline"
              >
                Cancel
              </button>
            </div>
            <p className="text-[11px] text-emerald-800 mb-3">
              Use this for mills that haven't done a formal submission yet.
              The fabric is stamped to both the mill and your distributor
              account so it shows up everywhere it should.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Mill <span className="text-red-500">*</span>
                </label>
                <select
                  value={newFabric.factoryId}
                  onChange={(e) =>
                    setNewFabric({ ...newFabric, factoryId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
                >
                  <option value="">Choose a mill…</option>
                  {factoryOptions
                    .filter((f) => f.assigned)
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                        {f.country ? ` · ${f.country}` : ""}
                      </option>
                    ))}
                </select>
              </div>
              <NewFabricField
                label="Customer ref"
                value={newFabric.customerReference}
                onChange={(v) => setNewFabric({ ...newFabric, customerReference: v })}
              />
              <NewFabricField
                label="Customer code"
                value={newFabric.customerCode}
                onChange={(v) => setNewFabric({ ...newFabric, customerCode: v })}
              />
              <NewFabricField
                label="Factory code"
                value={newFabric.factoryCode}
                onChange={(v) => setNewFabric({ ...newFabric, factoryCode: v })}
              />
              <NewFabricField
                label="Construction"
                value={newFabric.construction}
                onChange={(v) => setNewFabric({ ...newFabric, construction: v })}
              />
              <NewFabricField
                label="Color"
                value={newFabric.color}
                onChange={(v) => setNewFabric({ ...newFabric, color: v })}
              />
              <NewFabricField
                label="Yarn type"
                value={newFabric.yarnType}
                onChange={(v) => setNewFabric({ ...newFabric, yarnType: v })}
              />
              <NewFabricField
                label="Weight (gsm)"
                value={newFabric.weightGsm}
                onChange={(v) => setNewFabric({ ...newFabric, weightGsm: v })}
                type="number"
              />
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Fabric category
                </label>
                <select
                  value={newFabric.fabricCategory}
                  onChange={(e) =>
                    setNewFabric({ ...newFabric, fabricCategory: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
                >
                  <option value="">—</option>
                  <option value="knit">knit</option>
                  <option value="woven">woven</option>
                  <option value="nonwoven">nonwoven</option>
                </select>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleCreateNewFabric}
                disabled={creatingFabric || !newFabric.factoryId}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded text-xs font-bold"
              >
                {creatingFabric ? "Creating…" : "Create + use for this test"}
              </button>
              <button
                onClick={() => setShowNewFabric(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {selectedFabric ? (
          <div className="flex items-start justify-between gap-4 p-4 bg-[#00b4c3]/5 border border-[#00b4c3]/30 rounded-lg">
            <div>
              <div className="font-semibold text-slate-900">
                {selectedFabric.brand?.name || "Unbranded"}
                {selectedFabric.factory?.name && (
                  <span className="text-slate-500 font-normal">
                    {" "}
                    · {selectedFabric.factory.name}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {selectedFabric.fuzeNumber !== null && (
                  <span>
                    FUZE-
                    <span className="font-mono font-semibold text-slate-800">
                      {selectedFabric.fuzeNumber}
                    </span>
                  </span>
                )}
                {selectedFabric.customerCode && (
                  <span>
                    Brand item #:{" "}
                    <span className="font-mono text-slate-800">{selectedFabric.customerCode}</span>
                  </span>
                )}
                {selectedFabric.factoryCode && (
                  <span>
                    Factory item #:{" "}
                    <span className="font-mono text-slate-800">{selectedFabric.factoryCode}</span>
                  </span>
                )}
                {selectedFabric.fabricCategory && (
                  <span>
                    {selectedFabric.fabricCategory}
                    {selectedFabric.color ? ` · ${selectedFabric.color}` : ""}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setSelectedFabric(null)}
              className="text-xs text-slate-500 hover:text-slate-800 underline"
            >
              Change
            </button>
          </div>
        ) : (
          <>
            {/* Factory-first picker (Tina's original ask): select
                factory THEN fabric from that factory. The text search
                still works on top — leave the factory dropdown empty
                to fall back to global search across all factories. */}
            {factoryOptions.length > 0 && (
              <div className="mb-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Step 1 — Pick a factory <span className="text-slate-400 font-normal">(optional, narrows the fabric list)</span>
                </label>
                <select
                  value={factoryFilter}
                  onChange={(e) => setFactoryFilter(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none bg-white"
                >
                  <option value="">All factories</option>
                  {factoryOptions.filter((f) => f.assigned).length > 0 && (
                    <optgroup label="Your factories">
                      {factoryOptions
                        .filter((f) => f.assigned)
                        .map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                            {f.country ? ` · ${f.country}` : ""}
                          </option>
                        ))}
                    </optgroup>
                  )}
                  {factoryOptions.filter((f) => !f.assigned).length > 0 && (
                    <optgroup label="Other factories">
                      {factoryOptions
                        .filter((f) => !f.assigned)
                        .map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                            {f.country ? ` · ${f.country}` : ""}
                          </option>
                        ))}
                    </optgroup>
                  )}
                </select>
              </div>
            )}
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Step 2 — Pick the fabric
              {factoryFilter && (
                <span className="text-[#00b4c3] font-normal">
                  {" "}
                  · filtered to{" "}
                  {factoryOptions.find((f) => f.id === factoryFilter)?.name ||
                    "factory"}
                </span>
              )}
            </label>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={
                factoryFilter
                  ? "Search this factory's fabrics by FUZE#, code, color…"
                  : "Search by FUZE#, brand, factory, or item code…"
              }
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none mb-3"
            />
            {loadingFabrics ? (
              <div className="py-6 text-center text-sm text-slate-400">Searching…</div>
            ) : fabrics.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-400">
                {search
                  ? "No fabrics match your search in your scope."
                  : "Start typing to search fabrics in your scope."}
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {fabrics.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFabric(f)}
                    className="w-full text-left p-3 border border-slate-200 rounded-lg hover:border-[#00b4c3] hover:bg-[#00b4c3]/5 transition-all"
                  >
                    <div className="font-semibold text-slate-900 text-sm flex items-center gap-2 flex-wrap">
                      {(f as any).ownership === "distributor" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-purple-100 text-purple-800">
                          📒 PORTFOLIO
                        </span>
                      )}
                      <span>
                        {f.brand?.name || (f as any).customerReference || "Unbranded"}
                        {f.factory?.name && (
                          <span className="text-slate-500 font-normal"> · {f.factory.name}</span>
                        )}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3">
                      {f.fuzeNumber !== null && (
                        <span>
                          FUZE-<span className="font-mono">{f.fuzeNumber}</span>
                        </span>
                      )}
                      {f.customerCode && <span>{f.customerCode}</span>}
                      {f.factoryCode && <span>{f.factoryCode}</span>}
                      {f.color && <span>{f.color}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* Step 2: Pick a lab */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 mb-5">
        <h2 className="font-bold text-slate-900 mb-3">2. Choose lab</h2>
        {loadingLabs ? (
          <div className="py-4 text-sm text-slate-400">Loading labs…</div>
        ) : (
          <select
            value={selectedLab}
            onChange={(e) => {
              setSelectedLab(e.target.value);
              setSelectedTests({});
              setRushTests({});
            }}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
          >
            <option value="">— Choose a laboratory —</option>
            {labs.map((lab) => (
              <option key={lab.id} value={lab.id}>
                {lab.name}
                {[lab.city, lab.country].filter(Boolean).length > 0
                  ? ` — ${[lab.city, lab.country].filter(Boolean).join(", ")}`
                  : ""}{" "}
                ({lab.services.length} tests)
              </option>
            ))}
          </select>
        )}
      </section>

      {/* Step 3: Pick services */}
      {currentLab && services.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-xl p-5 mb-5">
          <h2 className="font-bold text-slate-900 mb-3">3. Choose tests</h2>
          <div className="space-y-2">
            {services.map((s) => {
              const checked = !!selectedTests[s.testMethod];
              return (
                <div
                  key={s.id}
                  className={`rounded-lg border-2 transition-all ${checked ? "border-[#00b4c3] bg-[#00b4c3]/5" : "border-slate-200"}`}
                >
                  <button
                    onClick={() =>
                      setSelectedTests((p) => ({ ...p, [s.testMethod]: !p[s.testMethod] }))
                    }
                    className="w-full p-3 text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-[#00b4c3] bg-[#00b4c3]/10 px-2 py-0.5 rounded">
                            {s.testMethod}
                          </span>
                          <span className="font-bold text-sm text-slate-900">
                            {s.testType.replace(/_/g, " ")}
                          </span>
                          {s.preferred && (
                            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded">
                              ★ {s.preferredNote || "Recommended"}
                            </span>
                          )}
                        </div>
                        {s.description && (
                          <p className="text-xs text-slate-500 mt-1">{s.description}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-black text-slate-900">
                          ${s.priceUSD?.toLocaleString() || "—"}
                        </div>
                        <div className="text-[10px] text-slate-500">{s.turnaroundDays} days</div>
                      </div>
                    </div>
                  </button>
                  {checked && s.rushPriceUSD && (
                    <div className="px-3 pb-3">
                      <button
                        onClick={() =>
                          setRushTests((p) => ({ ...p, [s.testMethod]: !p[s.testMethod] }))
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${rushTests[s.testMethod] ? "bg-amber-100 text-amber-700 border border-amber-300" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                      >
                        ⚡ Rush (+${s.rushPriceUSD}, {s.rushDays} days)
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Step 4: Priority + instructions + submit */}
      {selectedSvcRows.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-xl p-5 mb-5">
          <h2 className="font-bold text-slate-900 mb-3">4. Submit</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
              >
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            <div className="flex items-end">
              <div className="text-sm text-slate-600">
                Estimated cost:{" "}
                <span className="font-bold text-slate-900">${totalCost.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Special instructions (optional)
            </label>
            <textarea
              rows={3}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
              placeholder="Sample handling, conditioning, post-wash count, deadline…"
            />
          </div>
          <button
            onClick={submit}
            disabled={submitting || !selectedFabric || !selectedLab || selectedSvcRows.length === 0}
            className="px-5 py-2.5 bg-[#00b4c3] hover:bg-[#009ba8] disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors"
          >
            {submitting ? "Submitting…" : "Submit test request"}
          </button>
        </section>
      )}
    </div>
  );
}

function NewFabricField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-slate-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-emerald-400 outline-none"
      />
    </div>
  );
}
