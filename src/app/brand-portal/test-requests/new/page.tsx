"use client";

/**
 * /brand-portal/test-requests/new — NEED-3.
 *
 * Brand user kicks off a test request. The form auto-fills from the
 * brand's spec (required tier, protocol doc) + the last lab they used
 * so the user only has to pick the fabric + the tests they want.
 *
 * Calls /api/brand-portal/test-request (existing) for the lab + test
 * catalog and the eventual POST.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import ErrorPanel from "@/components/ErrorPanel";

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

interface Fabric {
  id: string;
  fuzeNumber: number | null;
  customerCode: string | null;
  factoryCode: string | null;
  brand?: { id: string; name: string } | null;
  factory?: { id: string; name: string } | null;
}

export default function BrandNewTestRequestPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [defaults, setDefaults] = useState<any>(null);
  const [defaultsApplied, setDefaultsApplied] = useState(false);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [fabricSearch, setFabricSearch] = useState("");
  const [fabricResults, setFabricResults] = useState<Fabric[]>([]);
  const [fabricLoading, setFabricLoading] = useState(false);
  const [selectedFabric, setSelectedFabric] = useState<Fabric | null>(null);
  const [selectedLab, setSelectedLab] = useState<string>("");
  const [selectedTests, setSelectedTests] = useState<Record<string, boolean>>({});
  const [rushTests, setRushTests] = useState<Record<string, boolean>>({});
  const [instructions, setInstructions] = useState("");
  const [priority, setPriority] = useState("NORMAL");

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [labsRes, defaultsRes] = await Promise.all([
        fetch("/api/brand-portal/test-request"),
        fetch("/api/brand-portal/test-requests/defaults"),
      ]);
      const labsJ = await labsRes.json().catch(() => null);
      const defaultsJ = await defaultsRes.json().catch(() => null);
      if (!labsRes.ok || !labsJ?.ok) {
        setLoadError(labsJ?.error || `Couldn't load labs (HTTP ${labsRes.status}).`);
        return;
      }
      setLabs(labsJ.labs || []);
      if (defaultsJ?.ok && defaultsJ.defaults) {
        const d = defaultsJ.defaults;
        setDefaults(d);
        if (d.suggestedLab?.id) {
          setSelectedLab(d.suggestedLab.id);
          setDefaultsApplied(true);
        } else {
          // Fall back to the FUZE-Atlas-flagged lab on the catalog.
          const fuze = labsJ.labs?.find((l: Lab) =>
            l.name.toLowerCase().includes("fuze"),
          );
          if (fuze) setSelectedLab(fuze.id);
        }
        if (d.suggestedPriority) setPriority(d.suggestedPriority);
      }
    } catch (e: any) {
      setLoadError(e?.message || "Network error while loading.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && user.role !== "BRAND_USER" && user.role !== "BRAND_MANAGER" && !["ADMIN", "EMPLOYEE"].includes(user.role)) {
      router.push("/dashboard");
      return;
    }
    load();
  }, [user, router, load]);

  // Fabric typeahead — search by FUZE number / customer code / brand.
  useEffect(() => {
    const q = fabricSearch.trim();
    if (!q) {
      setFabricResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setFabricLoading(true);
      try {
        const r = await fetch(`/api/fabrics?q=${encodeURIComponent(q)}&pageSize=15`);
        const j = await r.json();
        setFabricResults(j?.fabrics || j?.items || []);
      } catch {
        setFabricResults([]);
      } finally {
        setFabricLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [fabricSearch]);

  const currentLab = labs.find((l) => l.id === selectedLab);
  const services = currentLab?.services || [];
  const selectedSvcRows = services.filter((s) => selectedTests[s.testMethod]);
  const totalCost = selectedSvcRows.reduce(
    (sum, s) =>
      sum + (s.priceUSD || 0) + (rushTests[s.testMethod] ? s.rushPriceUSD || 0 : 0),
    0,
  );

  async function submit() {
    if (!selectedFabric) {
      setSubmitError("Pick a fabric first.");
      return;
    }
    if (!selectedLab) {
      setSubmitError("Pick a lab.");
      return;
    }
    if (selectedSvcRows.length === 0) {
      setSubmitError("Select at least one test.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/brand-portal/test-request", {
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
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) {
        setSubmitError(j?.error || `Submit failed (HTTP ${res.status}).`);
        return;
      }
      setSuccess(j.testRequest || j);
    } catch (e: any) {
      setSubmitError(e?.message || "Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        <ErrorPanel context="Load test request form" error={loadError} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/brand-portal" className="hover:text-[#00b4c3]">
            Brand Portal
          </Link>
          <span>›</span>
          <Link href="/brand-portal/tests" className="hover:text-[#00b4c3]">
            Tests
          </Link>
          <span>›</span>
          <span>New request</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900">New test request</h1>
        <p className="text-sm text-slate-500 mt-1">
          Pick a fabric + the tests you want; we'll route to the right lab. Pre-filled
          from your brand spec where possible.
        </p>
      </div>

      {defaultsApplied && defaults && (
        <div className="mb-4 p-3 bg-cyan-50 border border-cyan-200 rounded-lg flex items-start justify-between gap-3">
          <div className="text-xs text-slate-700">
            <p className="font-semibold text-cyan-900">Pre-filled from your spec</p>
            <p className="mt-0.5 text-slate-600">
              {defaults.requiredFuzeTier && (
                <>
                  Required tier{" "}
                  <span className="font-semibold text-slate-900">
                    {defaults.requiredFuzeTier}
                  </span>
                  .{" "}
                </>
              )}
              {defaults.suggestedLab?.name && (
                <>
                  Last lab used{" "}
                  <span className="font-semibold text-slate-900">
                    {defaults.suggestedLab.name}
                  </span>
                  .{" "}
                </>
              )}
              {defaults.protocolDocUrl && (
                <>
                  Protocol doc:{" "}
                  <a
                    href={defaults.protocolDocUrl}
                    target="_blank"
                    rel="noopener"
                    className="text-cyan-700 underline font-medium"
                  >
                    open
                  </a>
                  .
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {submitError && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {submitError}
        </div>
      )}

      {success ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 mb-6">
          <h2 className="font-bold text-emerald-900 mb-1">Test request submitted</h2>
          <p className="text-sm text-emerald-800">
            PO{" "}
            <span className="font-mono font-bold">
              {success.poNumber || success.poNumber || "—"}
            </span>{" "}
            sent. Estimated cost{" "}
            <span className="font-bold">
              ${(success.estimatedCost || 0).toLocaleString()}
            </span>
            .
          </p>
          <div className="mt-3 flex gap-2">
            <Link
              href="/brand-portal/tests"
              className="px-4 py-2 bg-[#00b4c3] hover:bg-[#009ba8] text-white rounded-lg text-sm font-semibold"
            >
              View test results
            </Link>
            <button
              onClick={() => {
                setSuccess(null);
                setSelectedFabric(null);
                setSelectedTests({});
                setRushTests({});
                setInstructions("");
                setFabricSearch("");
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium"
            >
              Submit another
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Step 1 — fabric */}
          <section className="bg-white border border-slate-200 rounded-xl p-5 mb-5">
            <h2 className="font-bold text-slate-900 mb-3">1. Choose fabric</h2>
            {selectedFabric ? (
              <div className="flex items-start justify-between gap-4 p-4 bg-[#00b4c3]/5 border border-[#00b4c3]/30 rounded-lg">
                <div className="text-sm">
                  <span className="font-bold text-slate-900">
                    FUZE-{selectedFabric.fuzeNumber ?? "?"}
                  </span>
                  {selectedFabric.customerCode && (
                    <span className="text-slate-500 ml-2">
                      · {selectedFabric.customerCode}
                    </span>
                  )}
                  {selectedFabric.factory?.name && (
                    <span className="text-slate-500 ml-2">
                      · {selectedFabric.factory.name}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    setSelectedFabric(null);
                    setFabricSearch("");
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 underline"
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={fabricSearch}
                  onChange={(e) => setFabricSearch(e.target.value)}
                  placeholder="Search by FUZE number, customer code, or factory…"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3] mb-2"
                />
                {fabricLoading ? (
                  <div className="py-3 text-xs text-slate-400">Searching…</div>
                ) : fabricResults.length > 0 ? (
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {fabricResults.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setSelectedFabric(f)}
                        className="w-full text-left p-3 border border-slate-200 rounded-lg hover:border-[#00b4c3] hover:bg-[#00b4c3]/5"
                      >
                        <div className="text-sm font-semibold text-slate-900">
                          FUZE-{f.fuzeNumber ?? "?"}
                          {f.customerCode && (
                            <span className="text-slate-500 font-normal">
                              {" "}· {f.customerCode}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {f.factory?.name ? `🏭 ${f.factory.name}` : ""}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : fabricSearch.trim() ? (
                  <div className="py-3 text-xs text-slate-400">No fabrics match.</div>
                ) : (
                  <div className="py-3 text-xs text-slate-400">
                    Start typing to search your brand's fabrics.
                  </div>
                )}
              </>
            )}
          </section>

          {/* Step 2 — lab */}
          <section className="bg-white border border-slate-200 rounded-xl p-5 mb-5">
            <h2 className="font-bold text-slate-900 mb-3">2. Choose lab</h2>
            <select
              value={selectedLab}
              onChange={(e) => {
                setSelectedLab(e.target.value);
                setSelectedTests({});
                setRushTests({});
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
            >
              <option value="">— Choose a lab —</option>
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
          </section>

          {/* Step 3 — services */}
          {currentLab && services.length > 0 && (
            <section className="bg-white border border-slate-200 rounded-xl p-5 mb-5">
              <h2 className="font-bold text-slate-900 mb-3">3. Choose tests</h2>
              <div className="space-y-2">
                {services.map((s) => {
                  const checked = !!selectedTests[s.testMethod];
                  return (
                    <div
                      key={s.id}
                      className={`rounded-lg border-2 ${checked ? "border-[#00b4c3] bg-[#00b4c3]/5" : "border-slate-200"}`}
                    >
                      <button
                        onClick={() =>
                          setSelectedTests((p) => ({
                            ...p,
                            [s.testMethod]: !p[s.testMethod],
                          }))
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
                              <p className="text-xs text-slate-500 mt-1">
                                {s.description}
                              </p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-black text-slate-900">
                              ${s.priceUSD?.toLocaleString() || "—"}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {s.turnaroundDays} days
                            </div>
                          </div>
                        </div>
                      </button>
                      {checked && s.rushPriceUSD && (
                        <div className="px-3 pb-3">
                          <button
                            onClick={() =>
                              setRushTests((p) => ({
                                ...p,
                                [s.testMethod]: !p[s.testMethod],
                              }))
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                              rushTests[s.testMethod]
                                ? "bg-amber-100 text-amber-700 border border-amber-300"
                                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                            }`}
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

          {/* Step 4 — priority + submit */}
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
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00b4c3]"
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <div className="text-sm text-slate-600">
                    Estimated cost:{" "}
                    <span className="font-bold text-slate-900">
                      ${totalCost.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
              <textarea
                rows={3}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Special instructions (sample handling, conditioning, post-wash count, deadline…)"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00b4c3] mb-3"
              />
              <button
                onClick={submit}
                disabled={submitting || !selectedFabric || selectedSvcRows.length === 0}
                className="px-5 py-2.5 bg-[#00b4c3] hover:bg-[#009ba8] disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold"
              >
                {submitting ? "Submitting…" : "Submit test request"}
              </button>
            </section>
          )}
        </>
      )}
    </div>
  );
}
