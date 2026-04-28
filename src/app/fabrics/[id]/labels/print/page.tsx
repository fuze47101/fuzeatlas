// @ts-nocheck
"use client";

/**
 * /fabrics/[id]/labels/print
 *
 * Printable label sheets for fabric samples that travel to a lab.
 * Two distinct 4×6 outputs in one print job — both designed for a
 * 4×6 label printer.
 *
 *   PAGE 1 — Carrier sticker sheet (4×6, 1 col × 5 rows)
 *     5 distinct labels, ~4"w × 1.2"h each. Cut along dashed lines
 *     and apply one to each cut sample so the fabric ID travels with
 *     the swatch.
 *
 *   PAGE 2 — Baggie sticker (single full 4×6)
 *     Sticks on the outside of the plastic baggie that holds all the
 *     cut samples. Combines fabric identity + the latest ICP test
 *     request (PO#, tier, lab) so the receiving tech can match the
 *     bag to a specific request without opening it.
 *
 * The page also surfaces a list of historical TestRequests for this
 * fabric so Tina can re-print labels for an older ICP request without
 * having to re-run the wizard. URL param `?requestId=xxx` lets her
 * pick a specific past request to label against.
 */

import { use, useEffect, useState } from "react";
import Link from "next/link";

interface TestRequestRef {
  id: string;
  poNumber: string;
  poDate: string;
  pricingTier: string | null;
  status: string;
  requestedAt: string | null;
  fuzeFabricNumber: string | null;
  customerFabricCode: string | null;
  factoryFabricCode: string | null;
  lab: { id: string; name: string; city: string | null; country: string | null } | null;
}

interface SampleAppRef {
  id: string;
  appNumber: string;
  tier: string | null;
  bathConcentrationMgPerL: number | null;
  bathVolumeL: number | null;
  paddedAt: string | null;
  driedAt: string | null;
  operator: string | null;
}

interface Fabric {
  id: string;
  fuzeNumber: number | null;
  customerCode: string | null;
  factoryCode: string | null;
  customerReference: string | null;
  construction: string | null;
  color: string | null;
  weightGsm: number | null;
  widthInches: number | null;
  yarnType: string | null;
  finishNote: string | null;
  note: string | null;
  endUse: string | null;
  targetFuzeTier: string | null;
  fabricCategory: string | null;
  knitStitchType: string | null;
  weavePattern: string | null;
  thickness: number | null;
  fabricPh: number | null;
  brand: { id: string; name: string } | null;
  factory: { id: string; name: string; country: string | null } | null;
  distributor: { id: string; name: string } | null;
  testRequests: TestRequestRef[];
  sampleApplications: SampleAppRef[];
  createdAt: string;
}

const LABELS_PER_SHEET = 5;

export default function FabricLabelsPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [fabric, setFabric] = useState<Fabric | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Caller can pin a specific past request via ?requestId=…
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    const r = u.searchParams.get("requestId");
    if (r) setSelectedRequestId(r);
  }, []);

  useEffect(() => {
    fetch(`/api/fabrics/${id}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setFabric(j.fabric);
        else setError(j.error || "Failed to load fabric");
      })
      .catch((e) => setError(e?.message || "Network error"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading fabric…</div>;
  }
  if (error || !fabric) {
    return (
      <div className="p-8">
        <p className="text-red-600 font-bold">Could not load fabric: {error}</p>
        <Link
          href={`/fabrics/${id}`}
          className="text-blue-600 hover:underline text-sm"
        >
          ← Back
        </Link>
      </div>
    );
  }

  const fuzeRef = fabric.fuzeNumber ? `FUZE-${fabric.fuzeNumber}` : "(no FUZE#)";
  const printedAt = new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  // Pick the test request for the baggie sticker:
  //   - If URL pinned a specific one, use it
  //   - Otherwise default to the most-recent
  const requests = fabric.testRequests || [];
  const selectedRequest =
    (selectedRequestId && requests.find((r) => r.id === selectedRequestId)) ||
    requests[0] ||
    null;

  // Latest sample application — gives us the actual tier applied
  // and the lab-relevant recipe details (concentration, bath
  // volume, padded/dried timestamps).
  const latestApp = (fabric.sampleApplications || [])[0] || null;

  const labels = Array.from({ length: LABELS_PER_SHEET }, (_, i) => i + 1);

  // What FUZE tier is going on the bag? Prefer the test request's
  // pricing tier (what was paid for) → fall back to applied tier on
  // the SampleApplication → fall back to fabric.targetFuzeTier.
  const tier =
    selectedRequest?.pricingTier ||
    latestApp?.tier ||
    fabric.targetFuzeTier ||
    null;

  return (
    <>
      <style jsx global>{`
        @page label-page {
          size: 4in 6in;
          margin: 0.1in;
        }
        @page baggie-page {
          size: 4in 6in;
          margin: 0.15in;
        }
        @media print {
          body {
            margin: 0;
            background: white;
          }
          .no-print {
            display: none !important;
          }
          .label-page {
            page: label-page;
            page-break-after: always;
          }
          .baggie-page {
            page: baggie-page;
            page-break-before: always;
          }
        }
        .label-cell {
          border: 1px dashed #94a3b8;
          padding: 0.1in 0.12in;
          font-family: "Helvetica Neue", Arial, sans-serif;
          color: #0f172a;
          page-break-inside: avoid;
          break-inside: avoid;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .label-cell .fuze {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas;
          font-size: 16pt;
          font-weight: 900;
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .label-cell .pri {
          font-weight: 700;
          font-size: 10pt;
          line-height: 1.2;
          margin-top: 2pt;
        }
        .label-cell .sec {
          color: #475569;
          font-size: 8pt;
          line-height: 1.3;
        }
        .baggie-h1 {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas;
          font-weight: 900;
          letter-spacing: -0.02em;
        }
      `}</style>

      {/* Hide-on-print header */}
      <div className="no-print bg-slate-900 text-white p-3 flex items-center justify-between gap-3 sticky top-0 z-10">
        <div>
          <Link
            href={`/fabrics/${id}`}
            className="text-xs text-slate-400 hover:text-white"
          >
            ← Back to fabric
          </Link>
          <p className="text-sm font-bold">
            Print labels — {fuzeRef}
            {fabric.customerReference ? ` · ${fabric.customerReference}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded font-bold text-sm"
          >
            🖨 Print
          </button>
        </div>
      </div>

      {/* Hide-on-print instructions + request picker */}
      <div className="no-print max-w-3xl mx-auto p-5 text-sm text-slate-700 space-y-3">
        <div>
          <p className="font-semibold">Two 4×6 sheets will print:</p>
          <ol className="list-decimal pl-5 space-y-1 text-xs mt-1">
            <li>
              <strong>Page 1 — carrier sticker sheet:</strong> 5 distinct
              labels stacked vertically. Cut along the dashed lines and
              apply one to each cut sample.
            </li>
            <li>
              <strong>Page 2 — baggie sticker:</strong> single full 4×6
              with fabric info + the ICP request data (PO#, tier, lab).
              Stick on the outside of the plastic baggie holding the
              cut samples.
            </li>
          </ol>
          <p className="text-xs text-slate-600 mt-2">
            Both pages use the same 4×6 paper size — set your label
            printer to <strong>4 × 6 inches</strong> + scale{" "}
            <strong>actual size</strong> and run them as a single job.
          </p>
        </div>

        {requests.length > 1 && (
          <div className="bg-amber-50 border border-amber-200 rounded p-3">
            <p className="font-semibold text-amber-900 mb-1">
              This fabric has {requests.length} test requests on file
            </p>
            <p className="text-xs text-amber-800 mb-2">
              The baggie sticker pulls from the selected request. Default
              is the most recent. Pick a different one to re-print
              labels for a past ICP run:
            </p>
            <select
              value={selectedRequest?.id || ""}
              onChange={(e) => setSelectedRequestId(e.target.value || null)}
              className="w-full text-sm px-3 py-2 border border-amber-300 rounded bg-white"
            >
              {requests.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.poNumber}
                  {r.pricingTier ? ` · ${r.pricingTier}` : ""}
                  {r.lab?.name ? ` · ${r.lab.name}` : ""}
                  {" · "}
                  {new Date(r.poDate).toLocaleDateString()}
                  {" · "}
                  {r.status}
                </option>
              ))}
            </select>
          </div>
        )}

        {!selectedRequest && (
          <div className="bg-rose-50 border border-rose-200 rounded p-3 text-xs text-rose-800">
            <strong>⚠ No ICP request linked to this fabric yet.</strong>
            {" "}
            The baggie sticker will print fabric identity but won't have
            a PO#, tier, or lab. Run the ICP Sample Prep wizard at{" "}
            <Link
              href="/admin/icp-sample-prep"
              className="text-rose-900 underline font-semibold"
            >
              /admin/icp-sample-prep
            </Link>{" "}
            first if this is going to a lab.
          </div>
        )}
      </div>

      {/* Page 1 — Carrier sticker sheet (5 labels, 1 col × 5 rows) */}
      <div
        className="label-page"
        style={{
          width: "4in",
          height: "6in",
          margin: "0.5in auto",
          background: "white",
          boxShadow: "0 0 4px rgba(0,0,0,0.15)",
          display: "grid",
          gridTemplateColumns: "1fr",
          gridTemplateRows: "repeat(5, 1fr)",
          gap: "0.05in",
        }}
      >
        {labels.map((n) => (
          <div key={n} className="label-cell">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: "6pt",
              }}
            >
              <div className="fuze">{fuzeRef}</div>
              {tier && (
                <div
                  style={{
                    background: "#0f172a",
                    color: "white",
                    fontWeight: 800,
                    fontSize: "9pt",
                    padding: "2pt 6pt",
                    borderRadius: "3pt",
                    letterSpacing: "0.02em",
                  }}
                >
                  {tier}
                </div>
              )}
            </div>
            {(fabric.customerReference || fabric.customerCode) && (
              <div className="pri">
                {fabric.customerReference || fabric.customerCode}
              </div>
            )}
            <div className="sec" style={{ marginTop: "2pt" }}>
              {fabric.brand?.name && <>🏷 {fabric.brand.name}</>}
              {fabric.brand?.name && fabric.factory?.name && " · "}
              {fabric.factory?.name && <>🏭 {fabric.factory.name}</>}
            </div>
            <div className="sec" style={{ marginTop: "1pt" }}>
              {fabric.factoryCode && <>fac:{fabric.factoryCode} · </>}
              {fabric.color && <>{fabric.color} · </>}
              {fabric.weightGsm && <>{fabric.weightGsm}gsm · </>}
              {fabric.widthInches && <>{fabric.widthInches}"</>}
            </div>
            {(fabric.construction || fabric.fabricCategory) && (
              <div className="sec" style={{ marginTop: "1pt" }}>
                {fabric.construction || fabric.fabricCategory}
                {fabric.knitStitchType ? ` · ${fabric.knitStitchType}` : ""}
                {fabric.weavePattern && !fabric.knitStitchType
                  ? ` · ${fabric.weavePattern}`
                  : ""}
              </div>
            )}
            {selectedRequest?.poNumber && (
              <div
                className="sec"
                style={{
                  marginTop: "1pt",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo",
                  fontWeight: 700,
                  color: "#0e7490",
                }}
              >
                {selectedRequest.poNumber}
                {selectedRequest.lab?.name ? ` → ${selectedRequest.lab.name}` : ""}
              </div>
            )}
            <div
              style={{
                marginTop: "auto",
                fontSize: "6.5pt",
                color: "#94a3b8",
                paddingTop: "2pt",
              }}
            >
              #{n} of {LABELS_PER_SHEET} · {printedAt}
            </div>
          </div>
        ))}
      </div>

      {/* Page 2 — Full 4×6 baggie sticker (fabric info + ICP request) */}
      <div
        className="baggie-page"
        style={{
          width: "4in",
          height: "6in",
          margin: "0.5in auto",
          background: "white",
          boxShadow: "0 0 4px rgba(0,0,0,0.15)",
          padding: "0.18in",
          fontFamily: "Helvetica Neue, Arial, sans-serif",
          color: "#0f172a",
          display: "flex",
          flexDirection: "column",
          fontSize: "8.5pt",
          lineHeight: 1.3,
          boxSizing: "border-box",
        }}
      >
        {/* Top brand bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "2px solid #00b4c3",
            paddingBottom: "4pt",
            marginBottom: "6pt",
          }}
        >
          <div
            style={{
              fontWeight: 900,
              fontSize: "11pt",
              letterSpacing: "0.04em",
            }}
          >
            FUZE BIOTECH
          </div>
          <div
            style={{
              fontSize: "7pt",
              color: "#475569",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            ICP Sample Submission
          </div>
        </div>

        {/* Big FUZE# header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: "8pt",
          }}
        >
          <div>
            <div
              className="baggie-h1"
              style={{ fontSize: "26pt", lineHeight: 0.95 }}
            >
              {fuzeRef}
            </div>
            {fabric.customerReference && (
              <div
                style={{
                  fontSize: "11pt",
                  fontWeight: 700,
                  color: "#334155",
                  marginTop: "1pt",
                }}
              >
                {fabric.customerReference}
              </div>
            )}
          </div>
          {tier && (
            <div
              style={{
                background: "#0f172a",
                color: "white",
                fontWeight: 900,
                fontSize: "20pt",
                padding: "4pt 10pt",
                borderRadius: "4pt",
                letterSpacing: "-0.02em",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo",
              }}
            >
              {tier}
            </div>
          )}
        </div>

        {/* Identity row */}
        <div
          style={{
            marginTop: "6pt",
            paddingTop: "4pt",
            borderTop: "1px solid #e2e8f0",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "3pt 8pt",
          }}
        >
          {fabric.brand?.name && (
            <BaggieField label="Brand" value={fabric.brand.name} />
          )}
          {fabric.factory?.name && (
            <BaggieField
              label="Factory"
              value={
                fabric.factory.country
                  ? `${fabric.factory.name} (${fabric.factory.country})`
                  : fabric.factory.name
              }
            />
          )}
          {fabric.distributor?.name && (
            <BaggieField label="Distributor" value={fabric.distributor.name} />
          )}
          {fabric.customerCode && (
            <BaggieField label="Customer Code" value={fabric.customerCode} />
          )}
          {fabric.factoryCode && (
            <BaggieField label="Factory Code" value={fabric.factoryCode} />
          )}
        </div>

        {/* Construction snapshot */}
        <div
          style={{
            marginTop: "6pt",
            paddingTop: "4pt",
            borderTop: "1px solid #e2e8f0",
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "3pt 8pt",
          }}
        >
          {fabric.fabricCategory && (
            <BaggieField label="Type" value={fabric.fabricCategory} />
          )}
          {fabric.construction && (
            <BaggieField label="Construction" value={fabric.construction} />
          )}
          {fabric.color && (
            <BaggieField label="Color" value={fabric.color} />
          )}
          {fabric.weightGsm && (
            <BaggieField label="Weight" value={`${fabric.weightGsm} gsm`} />
          )}
          {fabric.widthInches && (
            <BaggieField label="Width" value={`${fabric.widthInches}"`} />
          )}
          {fabric.yarnType && (
            <BaggieField label="Yarn" value={fabric.yarnType} />
          )}
          {fabric.fabricPh != null && (
            <BaggieField label="pH" value={String(fabric.fabricPh)} />
          )}
          {fabric.thickness && (
            <BaggieField label="Thick" value={`${fabric.thickness} mm`} />
          )}
          {fabric.endUse && (
            <BaggieField label="End use" value={fabric.endUse} />
          )}
        </div>

        {/* ICP REQUEST block — the part the lab cares about most */}
        <div
          style={{
            marginTop: "auto",
            border: "2px solid #0f172a",
            borderRadius: "4pt",
            padding: "5pt 7pt",
            background: "#f8fafc",
          }}
        >
          <div
            style={{
              fontSize: "7pt",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#0f172a",
              marginBottom: "2pt",
            }}
          >
            🧪 ICP Test Request
          </div>
          {selectedRequest ? (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: "8pt",
                }}
              >
                <div
                  style={{
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo",
                    fontWeight: 800,
                    fontSize: "11pt",
                  }}
                >
                  {selectedRequest.poNumber}
                </div>
                <div
                  style={{
                    fontSize: "8pt",
                    color: "#475569",
                    fontWeight: 600,
                  }}
                >
                  {selectedRequest.poDate
                    ? new Date(selectedRequest.poDate).toLocaleDateString()
                    : "—"}
                  {" · "}
                  {selectedRequest.status}
                </div>
              </div>
              {selectedRequest.lab && (
                <div style={{ marginTop: "1pt" }}>
                  <strong>Lab:</strong> {selectedRequest.lab.name}
                  {selectedRequest.lab.city ? ` · ${selectedRequest.lab.city}` : ""}
                  {selectedRequest.lab.country
                    ? `, ${selectedRequest.lab.country}`
                    : ""}
                </div>
              )}
              {latestApp && (
                <div style={{ marginTop: "1pt", color: "#475569" }}>
                  <strong>Applied recipe:</strong> {latestApp.appNumber}
                  {latestApp.bathConcentrationMgPerL != null && (
                    <> · {latestApp.bathConcentrationMgPerL.toFixed(2)} mg/L</>
                  )}
                  {latestApp.bathVolumeL != null && (
                    <> · {latestApp.bathVolumeL}L bath</>
                  )}
                  {latestApp.driedAt && (
                    <>
                      {" · dried "}
                      {new Date(latestApp.driedAt).toLocaleDateString()}
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            <div style={{ color: "#9f1239", fontWeight: 600 }}>
              No ICP request linked. Run the Sample Prep wizard before
              shipping or write the PO# on this label by hand.
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: "5pt",
            paddingTop: "3pt",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            fontSize: "6.5pt",
            color: "#94a3b8",
          }}
        >
          <span>
            FUZE Biotech · 1895 W 2100 S, SLC UT 84119 · andrew@fuze47.com
          </span>
          <span>{printedAt}</span>
        </div>
      </div>
    </>
  );
}

function BaggieField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ overflow: "hidden" }}>
      <div
        style={{
          fontSize: "6pt",
          color: "#64748b",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          lineHeight: 1.1,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontWeight: 600,
          fontSize: "8.5pt",
          lineHeight: 1.2,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </div>
    </div>
  );
}
