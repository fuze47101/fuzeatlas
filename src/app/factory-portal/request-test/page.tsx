"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useI18n } from "@/i18n";
import {
  FUZE_TEST_CATALOG,
  FUZE_SHIPPING_ADDRESSES,
  SHIPPING_INSTRUCTIONS,
  FuzeTestService,
} from "@/lib/fuze-test-catalog";

interface CatalogTest {
  id: string;
  name: string;
  description: string;
  category: string;
  moqMeters: number;
  controlRequired: boolean;
  controlNote: string | null;
  turnaroundDays: number;
  estimatedCostUsd: number | null;
  methods: string[];
  active: boolean;
}

interface Fabric {
  id: string;
  fuzeNumber?: number;
  customerCode?: string;
  factoryCode?: string;
}

interface LabOption {
  id: string;
  name: string;
  // Phase 15 hole-plug — full ship-to address + ops contact + sample
  // prep notes for the picked lab. Drives Section 5 of /factory-portal
  // /request-test so the shipping panel reflects the chosen lab rather
  // than always showing FUZE HQ.
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  region?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  opsContactName?: string | null;
  opsContactEmail?: string | null;
  opsContactPhone?: string | null;
  notes?: string | null;
  accreditations?: string | null;
  icpApproved: boolean;
  abApproved: boolean;
  fungalApproved: boolean;
  odorApproved: boolean;
  uvApproved: boolean;
}

export default function RequestFuzeTestPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const tx = t.factoryPortal.requestTestPage;
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [selectedFabric, setSelectedFabric] = useState("");
  const [selectedLab, setSelectedLab] = useState(""); // empty = "FUZE decides"
  const [labs, setLabs] = useState<LabOption[]>([]);
  const [selectedTests, setSelectedTests] = useState<Set<string>>(new Set());
  const [otherTestSelected, setOtherTestSelected] = useState(false);
  const [otherTestDescription, setOtherTestDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [showTrackingInput, setShowTrackingInput] = useState(false);

  // Dynamic test catalog from API (admin-managed pricing)
  const [testCatalog, setTestCatalog] = useState<CatalogTest[]>([]);

  // Load test catalog from API
  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const res = await fetch("/api/admin/test-catalog");
        const d = await res.json();
        if (d.ok && d.catalog) {
          setTestCatalog(d.catalog.filter((t: CatalogTest) => t.active));
        } else {
          // Fallback to static catalog if API fails
          setTestCatalog(FUZE_TEST_CATALOG.map((t) => ({ ...t, active: true })) as CatalogTest[]);
        }
      } catch {
        // Fallback to static catalog on network error
        setTestCatalog(FUZE_TEST_CATALOG.map((t) => ({ ...t, active: true })) as CatalogTest[]);
      }
    };
    loadCatalog();
  }, []);

  // Load active labs (for dropdown)
  useEffect(() => {
    const loadLabs = async () => {
      try {
        const res = await fetch("/api/labs");
        const d = await res.json();
        if (d.ok && Array.isArray(d.labs)) {
          setLabs(d.labs);
        }
      } catch (error) {
        console.error("Error loading labs:", error);
      }
    };
    loadLabs();
  }, []);

  // Load user's fabrics
  useEffect(() => {
    const loadFabrics = async () => {
      try {
        const res = await fetch("/api/factory-portal/fabrics", {
          headers: {
            "x-user-id": user?.id || "",
          },
        });
        const d = await res.json();
        if (d.ok && d.fabrics) {
          setFabrics(d.fabrics);
        }
      } catch (error) {
        console.error("Error loading fabrics:", error);
      } finally {
        setLoading(false);
      }
    };

    if (user?.id) {
      loadFabrics();
    }
  }, [user?.id]);

  const toggleTest = (testId: string) => {
    const next = new Set(selectedTests);
    if (next.has(testId)) {
      next.delete(testId);
    } else {
      next.add(testId);
    }
    setSelectedTests(next);
  };

  const selectedTestObjects = testCatalog.filter((t) => selectedTests.has(t.id));

  // Calculate total MOQ
  const totalMoq =
    selectedTestObjects.length > 0 ? Math.max(...selectedTestObjects.map((t) => t.moqMeters)) : 0;

  // Check if control required
  const controlRequiredForAny = selectedTestObjects.some((t) => t.controlRequired);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!selectedFabric) {
      setError("Please select a fabric");
      return;
    }

    if (selectedTests.size === 0 && !otherTestSelected) {
      setError("Please select at least one test");
      return;
    }

    if (otherTestSelected && !otherTestDescription.trim()) {
      setError("Please describe the test you need in the 'Other' field");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/factory-portal/request-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user?.id || "",
        },
        body: JSON.stringify({
          fabricId: selectedFabric,
          labId: selectedLab || null,
          selectedTests: [...Array.from(selectedTests), ...(otherTestSelected ? ["other"] : [])],
          controlRequired: controlRequiredForAny,
          totalMoqMeters: totalMoq,
          notes:
            otherTestSelected && otherTestDescription.trim()
              ? `${notes ? notes + "\n\n" : ""}[Other Test Requested]: ${otherTestDescription.trim()}`
              : notes,
          trackingNumber: trackingNumber || null,
        }),
      });

      const d = await res.json();
      if (d.ok) {
        setSubmitted(true);
      } else {
        setError(d.error || "Failed to submit test request");
      }
    } catch (error) {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="p-4 sm:p-8 max-w-2xl mx-auto">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-emerald-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-emerald-900 mb-2">{tx.successTitle}</h2>
          <p className="text-emerald-700 mb-4">
            Your FUZE test request has been submitted successfully. Please prepare your fabric
            samples according to the shipping instructions and submit them to the address below.
          </p>
          <button
            onClick={() => {
              setSubmitted(false);
              setSelectedFabric("");
              setSelectedLab("");
              setSelectedTests(new Set());
              setOtherTestSelected(false);
              setOtherTestDescription("");
              setNotes("");
              setTrackingNumber("");
            }}
            className="inline-flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium text-sm"
          >
            Submit Another Request
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-8 flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">{tx.pageTitle}</h1>
        <p className="text-slate-600">{tx.pageSubtitle}</p>
      </div>

      {/* Main form */}
      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Section 1: Select Fabric */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-[#00b4c3] text-white text-sm font-bold flex items-center justify-center">
              1
            </div>
            <h2 className="text-lg font-semibold text-slate-900">{tx.sectionFabric}</h2>
          </div>

          {fabrics.length === 0 ? (
            <p className="text-slate-500 text-sm">
              No fabrics found. Please submit a fabric first.
            </p>
          ) : (
            <select
              value={selectedFabric}
              onChange={(e) => setSelectedFabric(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-[#00b4c3] focus:border-[#00b4c3] text-sm"
            >
              <option value="">Choose a fabric...</option>
              {fabrics.map((f) => (
                <option key={f.id} value={f.id}>
                  FUZE-{f.fuzeNumber} {f.customerCode ? `(${f.customerCode})` : ""}
                  {f.factoryCode ? ` - ${f.factoryCode}` : ""}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Section 2: Select Lab */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-[#00b4c3] text-white text-sm font-bold flex items-center justify-center">
              2
            </div>
            <h2 className="text-lg font-semibold text-slate-900">{tx.sectionLab}</h2>
            <span className="text-xs text-slate-500">
              (optional — FUZE will route if left blank)
            </span>
          </div>

          {labs.length === 0 ? (
            <p className="text-slate-500 text-sm">Loading labs…</p>
          ) : (
            <>
              <select
                value={selectedLab}
                onChange={(e) => setSelectedLab(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-[#00b4c3] focus:border-[#00b4c3] text-sm"
              >
                <option value="">Let FUZE decide (recommended)</option>
                {labs.map((lab) => {
                  const loc = [lab.city, lab.state, lab.country].filter(Boolean).join(", ");
                  return (
                    <option key={lab.id} value={lab.id}>
                      {lab.name}
                      {loc ? ` — ${loc}` : ""}
                    </option>
                  );
                })}
              </select>

              {/* Capability chips for the picked lab */}
              {selectedLab &&
                (() => {
                  const lab = labs.find((l) => l.id === selectedLab);
                  if (!lab) return null;
                  const caps: string[] = [];
                  if (lab.icpApproved) caps.push("ICP");
                  if (lab.abApproved) caps.push("Antibacterial");
                  if (lab.fungalApproved) caps.push("Antifungal");
                  if (lab.odorApproved) caps.push("Odor");
                  if (lab.uvApproved) caps.push("UV");
                  return (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {caps.length === 0 ? (
                        <span className="text-xs text-slate-500 italic">
                          No capability flags set on this lab.
                        </span>
                      ) : (
                        caps.map((c) => (
                          <span
                            key={c}
                            className="px-2 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full border border-emerald-200"
                          >
                            ✓ {c}
                          </span>
                        ))
                      )}
                      {lab.accreditations && (
                        <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded-full border border-slate-200">
                          {lab.accreditations}
                        </span>
                      )}
                    </div>
                  );
                })()}
            </>
          )}
        </div>

        {/* Section 3: Select Tests */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-[#00b4c3] text-white text-sm font-bold flex items-center justify-center">
              3
            </div>
            <h2 className="text-lg font-semibold text-slate-900">{tx.sectionTests}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {testCatalog.map((test) => (
              <label
                key={test.id}
                className="relative p-4 border-2 rounded-lg cursor-pointer transition-all hover:border-[#00b4c3] hover:bg-[#00b4c3]/5"
                style={{
                  borderColor: selectedTests.has(test.id) ? "#00b4c3" : "#e2e8f0",
                  backgroundColor: selectedTests.has(test.id)
                    ? "rgba(0, 180, 195, 0.05)"
                    : "transparent",
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedTests.has(test.id)}
                  onChange={() => toggleTest(test.id)}
                  className="absolute top-4 right-4 w-5 h-5 rounded border-slate-300 text-[#00b4c3] focus:ring-[#00b4c3]"
                />

                <div className="pr-8">
                  <h3 className="font-semibold text-slate-900 text-sm mb-1">{test.name}</h3>
                  <p className="text-slate-600 text-xs mb-3">{test.description}</p>

                  <div className="space-y-2 text-xs text-slate-500">
                    <div>
                      <span className="font-medium">MOQ:</span> {test.moqMeters}m
                    </div>
                    <div>
                      <span className="font-medium">Turnaround:</span> {test.turnaroundDays} days
                    </div>
                    {test.estimatedCostUsd && (
                      <div>
                        <span className="font-medium">Est. Cost:</span> ${test.estimatedCostUsd}
                      </div>
                    )}
                    {test.controlRequired && (
                      <div className="text-orange-600 font-medium">Control fabric required</div>
                    )}
                  </div>
                </div>
              </label>
            ))}

            {/* Other Test Option */}
            <label
              className="relative p-4 border-2 rounded-lg cursor-pointer transition-all hover:border-[#00b4c3] hover:bg-[#00b4c3]/5"
              style={{
                borderColor: otherTestSelected ? "#00b4c3" : "#e2e8f0",
                backgroundColor: otherTestSelected ? "rgba(0, 180, 195, 0.05)" : "transparent",
              }}
            >
              <input
                type="checkbox"
                checked={otherTestSelected}
                onChange={() => setOtherTestSelected(!otherTestSelected)}
                className="absolute top-4 right-4 w-5 h-5 rounded border-slate-300 text-[#00b4c3] focus:ring-[#00b4c3]"
              />
              <div className="pr-8">
                <h3 className="font-semibold text-slate-900 text-sm mb-1">Other</h3>
                <p className="text-slate-600 text-xs mb-3">
                  Request a test method not listed above. Describe the test and we will provide a
                  quote.
                </p>
                {otherTestSelected && (
                  <textarea
                    value={otherTestDescription}
                    onChange={(e) => setOtherTestDescription(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Describe the test method, standard, or requirements..."
                    rows={3}
                    className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                  />
                )}
              </div>
            </label>
          </div>
        </div>

        {/* Section 4: MOQ & Control Requirements */}
        {selectedTests.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h3 className="font-semibold text-blue-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {tx.sectionRequirements}
            </h3>

            <div className="space-y-3 text-sm">
              <div>
                <p className="font-medium text-slate-900 mb-1">Minimum Sample:</p>
                <p className="text-slate-700">
                  <strong>{totalMoq} meters</strong> (largest MOQ of selected tests)
                </p>
              </div>

              {controlRequiredForAny && (
                <div>
                  <p className="font-medium text-orange-900 mb-1 flex items-center gap-2">
                    <span className="text-lg">⚠️</span>
                    Control Fabric Required
                  </p>
                  <p className="text-slate-700">
                    For accurate results, you must supply an equal amount of{" "}
                    <strong>untreated control fabric</strong> from the same production lot/batch.
                  </p>
                </div>
              )}

              <div>
                <p className="font-medium text-slate-900 mb-1">Tests Selected:</p>
                <div className="flex flex-wrap gap-2">
                  {selectedTestObjects.map((t) => (
                    <span
                      key={t.id}
                      className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full"
                    >
                      {t.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Estimated cost total */}
              {selectedTestObjects.some((t) => t.estimatedCostUsd) && (
                <div className="pt-3 mt-3 border-t border-blue-200">
                  <p className="font-medium text-slate-900 mb-1">Estimated Cost:</p>
                  <div className="space-y-1 text-sm text-slate-700">
                    {selectedTestObjects
                      .filter((t) => t.estimatedCostUsd)
                      .map((t) => (
                        <div key={t.id} className="flex justify-between">
                          <span>{t.name}</span>
                          <span className="font-semibold">
                            ${t.estimatedCostUsd?.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    <div className="flex justify-between pt-2 border-t border-blue-200 font-bold text-slate-900">
                      <span>Total Estimated</span>
                      <span>
                        $
                        {selectedTestObjects
                          .reduce((sum, t) => sum + (t.estimatedCostUsd || 0), 0)
                          .toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Section 5: Shipping Information */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-[#00b4c3] text-white text-sm font-bold flex items-center justify-center">
              5
            </div>
            <h2 className="text-lg font-semibold text-slate-900">
              {tx.sectionShipping}
            </h2>
          </div>

          {/* Picked-lab address card — Phase 15 hole-plug (Tina ticket
              cmp1ukl2r). When a specific lab is chosen, show its address
              + ops contact + lab-supplied sample prep notes here, instead
              of always showing the static FUZE HQ addresses. When the
              user leaves "Let FUZE decide", fall back to the FUZE
              shipping addresses below. */}
          {(() => {
            const lab = labs.find((l) => l.id === selectedLab);
            if (!lab) return null;
            const cityLine = [lab.city, lab.state, lab.country].filter(Boolean).join(", ");
            return (
              <div className="mb-6 p-4 border-2 border-[#00b4c3] rounded-lg bg-[#00b4c3]/5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h4 className="font-bold text-slate-900">
                    Ship to: {lab.name}
                  </h4>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#00b4c3] text-white font-bold uppercase tracking-wider">
                    Selected lab
                  </span>
                </div>
                <div className="space-y-1 text-sm text-slate-700">
                  {lab.opsContactName && (
                    <p>
                      ATTN: <span className="font-medium">{lab.opsContactName}</span>
                    </p>
                  )}
                  {lab.address ? (
                    <p>{lab.address}</p>
                  ) : (
                    <p className="text-amber-700 italic">
                      Street address not on file — contact the lab directly before shipping.
                    </p>
                  )}
                  {cityLine && <p>{cityLine}</p>}
                  {(lab.opsContactPhone || lab.phone) && (
                    <p>Phone: {lab.opsContactPhone || lab.phone}</p>
                  )}
                  {(lab.opsContactEmail || lab.email) && (
                    <p>Email: {lab.opsContactEmail || lab.email}</p>
                  )}
                </div>
                {lab.notes && (
                  <div className="mt-3 p-3 bg-white border border-[#00b4c3]/40 rounded-md">
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Sample-prep instructions from {lab.name}
                    </p>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap">{lab.notes}</p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* FUZE Shipping Addresses — shown when no specific lab is
              chosen (the "Let FUZE decide" path) so factories still have
              a default ship-to fallback. */}
          {!selectedLab && (
            <div className="space-y-4 mb-6">
              {FUZE_SHIPPING_ADDRESSES.map((addr) => (
                <div key={addr.label} className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                  <h4 className="font-semibold text-slate-900 mb-2">{addr.label}</h4>
                  <div className="space-y-1 text-sm text-slate-700">
                    <p>
                      <span className="font-medium">{addr.company}</span>
                    </p>
                    <p>ATTN: {addr.attention}</p>
                    <p>{addr.address1}</p>
                    {addr.address2 && <p>{addr.address2}</p>}
                    <p>
                      {addr.city}
                      {addr.stateProvince && `, ${addr.stateProvince}`}
                      {addr.postalCode && ` ${addr.postalCode}`}
                    </p>
                    <p>{addr.country}</p>
                    {addr.phone && <p>Phone: {addr.phone}</p>}
                    {addr.email && <p>Email: {addr.email}</p>}
                  </div>
                  {addr.notes && <p className="mt-2 text-xs text-slate-600 italic">{addr.notes}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Shipping Instructions */}
          <div className="mb-6">
            <h4 className="font-semibold text-slate-900 mb-3 text-sm">Shipping Instructions</h4>
            <ul className="space-y-2">
              {SHIPPING_INSTRUCTIONS.map((instruction, idx) => (
                <li key={idx} className="flex gap-3 text-sm text-slate-700">
                  <span className="text-[#00b4c3] font-bold flex-shrink-0">•</span>
                  <span>{instruction}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Tracking Number */}
          <div>
            <button
              type="button"
              onClick={() => setShowTrackingInput(!showTrackingInput)}
              className="text-sm text-[#00b4c3] font-medium hover:underline"
            >
              {showTrackingInput ? "Hide" : "Add"} Tracking Number
            </button>

            {showTrackingInput && (
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="Enter DHL/FedEx/UPS tracking number..."
                className="mt-3 w-full px-4 py-2.5 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-[#00b4c3] focus:border-[#00b4c3] text-sm"
              />
            )}
          </div>
        </div>

        {/* Section 6: Additional Notes */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-[#00b4c3] text-white text-sm font-bold flex items-center justify-center">
              6
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Additional Notes</h2>
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any special instructions or additional information for the lab..."
            rows={4}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-[#00b4c3] focus:border-[#00b4c3] text-sm"
          />
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting || (selectedTests.size === 0 && !otherTestSelected)}
            className="flex-1 bg-gradient-to-r from-[#00b4c3] to-[#009ba8] text-white py-3 rounded-lg font-semibold text-sm hover:shadow-lg hover:shadow-[#00b4c3]/30 transition-all disabled:opacity-50"
          >
            {submitting ? tx.submittingButton : tx.submitButton}
          </button>
        </div>
      </form>
    </div>
  );
}
