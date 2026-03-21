"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import {
  FUZE_TEST_CATALOG,
  FUZE_SHIPPING_ADDRESSES,
  SHIPPING_INSTRUCTIONS,
  FuzeTestService,
} from "@/lib/fuze-test-catalog";

interface Fabric {
  id: string;
  fuzeNumber?: number;
  customerCode?: string;
  factoryCode?: string;
}

export default function RequestFuzeTestPage() {
  const { user } = useAuth();
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [selectedFabric, setSelectedFabric] = useState("");
  const [selectedTests, setSelectedTests] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [showTrackingInput, setShowTrackingInput] = useState(false);

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

  const selectedTestObjects = FUZE_TEST_CATALOG.filter((t) =>
    selectedTests.has(t.id)
  );

  // Calculate total MOQ
  const totalMoq =
    selectedTestObjects.length > 0
      ? Math.max(...selectedTestObjects.map((t) => t.moqMeters))
      : 0;

  // Check if control required
  const controlRequiredForAny = selectedTestObjects.some(
    (t) => t.controlRequired
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!selectedFabric) {
      setError("Please select a fabric");
      return;
    }

    if (selectedTests.size === 0) {
      setError("Please select at least one test");
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
          selectedTests: Array.from(selectedTests),
          controlRequired: controlRequiredForAny,
          totalMoqMeters: totalMoq,
          notes,
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
          <h2 className="text-xl font-bold text-emerald-900 mb-2">
            Test Request Submitted
          </h2>
          <p className="text-emerald-700 mb-4">
            Your FUZE test request has been submitted successfully. Please
            prepare your fabric samples according to the shipping instructions
            and submit them to the address below.
          </p>
          <button
            onClick={() => {
              setSubmitted(false);
              setSelectedFabric("");
              setSelectedTests(new Set());
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
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
          Request FUZE Test
        </h1>
        <p className="text-slate-600">
          Select a fabric and the FUZE tests you need performed. Our lab will
          handle sample preparation, testing, and reporting.
        </p>
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
            <h2 className="text-lg font-semibold text-slate-900">
              Select Fabric
            </h2>
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

        {/* Section 2: Select Tests */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-[#00b4c3] text-white text-sm font-bold flex items-center justify-center">
              2
            </div>
            <h2 className="text-lg font-semibold text-slate-900">
              Select Tests
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FUZE_TEST_CATALOG.map((test) => (
              <label
                key={test.id}
                className="relative p-4 border-2 rounded-lg cursor-pointer transition-all hover:border-[#00b4c3] hover:bg-[#00b4c3]/5"
                style={{
                  borderColor: selectedTests.has(test.id)
                    ? "#00b4c3"
                    : "#e2e8f0",
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
                  <h3 className="font-semibold text-slate-900 text-sm mb-1">
                    {test.name}
                  </h3>
                  <p className="text-slate-600 text-xs mb-3">
                    {test.description}
                  </p>

                  <div className="space-y-2 text-xs text-slate-500">
                    <div>
                      <span className="font-medium">MOQ:</span> {test.moqMeters}m
                    </div>
                    <div>
                      <span className="font-medium">Turnaround:</span>{" "}
                      {test.turnaroundDays} days
                    </div>
                    {test.estimatedCostUsd && (
                      <div>
                        <span className="font-medium">Est. Cost:</span> $
                        {test.estimatedCostUsd}
                      </div>
                    )}
                    {test.controlRequired && (
                      <div className="text-orange-600 font-medium">
                        Control fabric required
                      </div>
                    )}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Section 3: MOQ & Control Requirements */}
        {selectedTests.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h3 className="font-semibold text-blue-900 mb-4 flex items-center gap-2">
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Sample Requirements
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
                    <strong>untreated control fabric</strong> from the same
                    production lot/batch.
                  </p>
                </div>
              )}

              <div>
                <p className="font-medium text-slate-900 mb-1">
                  Tests Selected:
                </p>
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
            </div>
          </div>
        )}

        {/* Section 4: Shipping Information */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-[#00b4c3] text-white text-sm font-bold flex items-center justify-center">
              3
            </div>
            <h2 className="text-lg font-semibold text-slate-900">
              Shipping Address & Instructions
            </h2>
          </div>

          {/* Shipping Addresses */}
          <div className="space-y-4 mb-6">
            {FUZE_SHIPPING_ADDRESSES.map((addr) => (
              <div
                key={addr.label}
                className="p-4 border border-slate-200 rounded-lg bg-slate-50"
              >
                <h4 className="font-semibold text-slate-900 mb-2">
                  {addr.label}
                </h4>
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
                {addr.notes && (
                  <p className="mt-2 text-xs text-slate-600 italic">
                    {addr.notes}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Shipping Instructions */}
          <div className="mb-6">
            <h4 className="font-semibold text-slate-900 mb-3 text-sm">
              Shipping Instructions
            </h4>
            <ul className="space-y-2">
              {SHIPPING_INSTRUCTIONS.map((instruction, idx) => (
                <li key={idx} className="flex gap-3 text-sm text-slate-700">
                  <span className="text-[#00b4c3] font-bold flex-shrink-0">
                    •
                  </span>
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

        {/* Section 5: Additional Notes */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-[#00b4c3] text-white text-sm font-bold flex items-center justify-center">
              4
            </div>
            <h2 className="text-lg font-semibold text-slate-900">
              Additional Notes
            </h2>
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
            disabled={submitting || selectedTests.size === 0}
            className="flex-1 bg-gradient-to-r from-[#00b4c3] to-[#009ba8] text-white py-3 rounded-lg font-semibold text-sm hover:shadow-lg hover:shadow-[#00b4c3]/30 transition-all disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit Test Request"}
          </button>
        </div>
      </form>
    </div>
  );
}
