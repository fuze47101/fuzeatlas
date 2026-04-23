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
  const [instructions, setInstructions] = useState("");
  const [priority, setPriority] = useState("NORMAL");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{
    poNumber: string;
    estimatedCost: number;
    labName?: string;
  } | null>(null);

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
    fetch(`/api/distributor-portal/fabric-search?${params.toString()}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setFabrics(j.fabrics);
        else setError(j.error || "Failed to search fabrics");
      })
      .finally(() => setLoadingFabrics(false));
  }, [user, search]);

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
        <h2 className="font-bold text-slate-900 mb-3">1. Choose fabric</h2>
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
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by FUZE#, brand, factory, or item code…"
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
                    <div className="font-semibold text-slate-900 text-sm">
                      {f.brand?.name || "Unbranded"}
                      {f.factory?.name && (
                        <span className="text-slate-500 font-normal"> · {f.factory.name}</span>
                      )}
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
