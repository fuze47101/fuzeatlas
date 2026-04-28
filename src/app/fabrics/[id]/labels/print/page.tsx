// @ts-nocheck
"use client";

/**
 * /fabrics/[id]/labels/print
 *
 * Printable label sheet for fabric samples that travel to a lab.
 *
 * Two pages in one print job:
 *   1. 4×6 inch label sheet with 10 distinct stickers (2 cols × 5 rows)
 *      — peel-and-stick on each cut sample so the fabric ID travels
 *      with the swatch even after the bag is opened.
 *   2. Letter-size packing list — full fabric specs in a single
 *      header sheet that drops into the bag with the cut samples.
 *
 * Tina prints both at once and ships:
 *   - 10 × labeled cuts → for the lab tech to keep with each test
 *   - 1 × packing list → for the lab to file
 *
 * Print sizing:
 *   The 4×6 page is configured via @page CSS so a label printer set
 *   to "actual size" produces a real 4"×6" sticker sheet. The Letter
 *   page uses normal margins.
 *
 * Hide-on-print: header bar with "🖨 Print" button + back link.
 * Everything else is print-clean.
 */

import { use, useEffect, useState } from "react";
import Link from "next/link";

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
  shrinkageLength: number | null;
  shrinkageWidth: number | null;
  fabricPh: number | null;
  brand: { id: string; name: string } | null;
  factory: { id: string; name: string; country: string | null } | null;
  distributor: { id: string; name: string } | null;
  createdAt: string;
}

export default function FabricLabelsPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [fabric, setFabric] = useState<Fabric | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const labels = Array.from({ length: 10 }, (_, i) => i + 1);

  return (
    <>
      {/* Print-only CSS — sets up two distinct page sizes for the
          two parts of this print job. */}
      <style jsx global>{`
        @page label-page {
          size: 4in 6in;
          margin: 0.1in;
        }
        @page packing-page {
          size: letter;
          margin: 0.4in;
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
          .packing-page {
            page: packing-page;
            page-break-before: always;
          }
        }
        .label-cell {
          border: 1px dashed #cbd5e1; /* dashed cut lines */
          padding: 0.06in;
          font-family: "Helvetica Neue", Arial, sans-serif;
          font-size: 7pt;
          line-height: 1.15;
          color: #0f172a;
          page-break-inside: avoid;
          break-inside: avoid;
          overflow: hidden;
        }
        .label-cell .fuze {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas;
          font-size: 11pt;
          font-weight: 900;
          letter-spacing: -0.02em;
        }
        .label-cell .pri {
          font-weight: 700;
          font-size: 8pt;
          line-height: 1.2;
        }
        .label-cell .sec {
          color: #475569;
          font-size: 6.5pt;
          line-height: 1.25;
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

      {/* Hide-on-print instructions */}
      <div className="no-print max-w-3xl mx-auto p-5 text-sm text-slate-700 space-y-2">
        <p className="font-semibold">Two pages will print:</p>
        <ol className="list-decimal pl-5 space-y-1 text-xs">
          <li>
            <strong>Page 1 — 4×6 sticker sheet:</strong> 10 distinct labels in a
            2×5 grid. Cut along the dashed lines and apply one to each
            sample swatch headed to the lab. In your printer dialog set
            paper size to <strong>4 × 6 inches</strong> and print scale to{" "}
            <strong>actual size</strong>.
          </li>
          <li>
            <strong>Page 2 — packing list:</strong> letter-size full spec
            sheet that drops into the sample bag for the lab to file. Set
            paper to <strong>Letter</strong> and scale to{" "}
            <strong>fit to page</strong> if your printer dialog merges the
            pages.
          </li>
        </ol>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
          Tip — most label printers expect their own paper size selected
          BEFORE clicking print. If pages 1 and 2 land on the wrong
          paper, print just page 1 to the label printer, then just page
          2 to a regular printer.
        </p>
      </div>

      {/* Page 1 — 4×6 sticker sheet, 2 cols × 5 rows = 10 stickers */}
      <div
        className="label-page"
        style={{
          width: "4in",
          height: "6in",
          margin: "0 auto",
          background: "white",
          boxShadow: "0 0 4px rgba(0,0,0,0.15)",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "repeat(5, 1fr)",
          gap: "0.04in",
        }}
      >
        {labels.map((n) => (
          <div key={n} className="label-cell">
            <div className="fuze">{fuzeRef}</div>
            {(fabric.customerReference || fabric.customerCode) && (
              <div className="pri">
                {fabric.customerReference || fabric.customerCode}
              </div>
            )}
            <div className="sec" style={{ marginTop: "1pt" }}>
              {fabric.brand?.name && <>🏷 {fabric.brand.name}</>}
              {fabric.brand?.name && fabric.factory?.name && " · "}
              {fabric.factory?.name && <>🏭 {fabric.factory.name}</>}
            </div>
            <div className="sec">
              {fabric.factoryCode && <>fac:{fabric.factoryCode} </>}
              {fabric.color && <>{fabric.color} </>}
              {fabric.weightGsm && <>{fabric.weightGsm}gsm </>}
              {fabric.widthInches && <>{fabric.widthInches}"</>}
            </div>
            <div className="sec" style={{ marginTop: "1pt" }}>
              {fabric.construction || fabric.fabricCategory || ""}
              {fabric.targetFuzeTier && (
                <span style={{ float: "right", fontWeight: 700 }}>
                  {fabric.targetFuzeTier}
                </span>
              )}
            </div>
            <div
              className="sec"
              style={{ marginTop: "auto", fontSize: "5.5pt", color: "#94a3b8" }}
            >
              #{n} of 10 · {printedAt}
            </div>
          </div>
        ))}
      </div>

      {/* Page 2 — Packing list (Letter size). Goes in the bag with
          the cut samples for the lab to file. */}
      <div
        className="packing-page"
        style={{
          maxWidth: "7.5in",
          margin: "0.4in auto",
          padding: "0",
          fontFamily: "Helvetica Neue, Arial, sans-serif",
          color: "#0f172a",
          background: "white",
        }}
      >
        <div
          style={{
            borderBottom: "3px solid #00b4c3",
            paddingBottom: "0.15in",
            marginBottom: "0.2in",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
            }}
          >
            <div>
              <p
                style={{
                  fontSize: "9pt",
                  color: "#64748b",
                  letterSpacing: "0.05em",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  margin: 0,
                }}
              >
                Sample Packing List
              </p>
              <h1
                style={{
                  fontSize: "28pt",
                  fontWeight: 900,
                  margin: "2pt 0 0",
                  letterSpacing: "-0.02em",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco",
                }}
              >
                {fuzeRef}
              </h1>
              {fabric.customerReference && (
                <p
                  style={{
                    fontSize: "13pt",
                    fontWeight: 600,
                    margin: "1pt 0 0",
                    color: "#334155",
                  }}
                >
                  {fabric.customerReference}
                </p>
              )}
            </div>
            <div style={{ textAlign: "right", fontSize: "9pt", color: "#475569" }}>
              <p style={{ margin: 0 }}>
                Printed <strong>{printedAt}</strong>
              </p>
              <p style={{ margin: "1pt 0 0" }}>FUZE Biotech, Inc.</p>
              <p style={{ margin: "1pt 0 0" }}>
                1895 W 2100 S, Salt Lake City, UT 84119
              </p>
            </div>
          </div>
        </div>

        {/* Identity grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.15in 0.3in",
            fontSize: "10pt",
          }}
        >
          {fabric.brand?.name && (
            <Field label="Brand" value={fabric.brand.name} />
          )}
          {fabric.factory?.name && (
            <Field
              label="Factory"
              value={`${fabric.factory.name}${
                fabric.factory.country ? ` · ${fabric.factory.country}` : ""
              }`}
            />
          )}
          {fabric.distributor?.name && (
            <Field label="Distributor" value={fabric.distributor.name} />
          )}
          {fabric.customerCode && (
            <Field label="Customer Code" value={fabric.customerCode} />
          )}
          {fabric.factoryCode && (
            <Field label="Factory Code" value={fabric.factoryCode} />
          )}
          {fabric.targetFuzeTier && (
            <Field label="Target Tier" value={fabric.targetFuzeTier} />
          )}
        </div>

        {/* Construction block */}
        <div
          style={{
            marginTop: "0.25in",
            paddingTop: "0.15in",
            borderTop: "1px solid #e2e8f0",
          }}
        >
          <p
            style={{
              fontSize: "9pt",
              color: "#64748b",
              letterSpacing: "0.05em",
              fontWeight: 700,
              textTransform: "uppercase",
              margin: "0 0 0.1in 0",
            }}
          >
            Construction
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "0.1in 0.3in",
              fontSize: "10pt",
            }}
          >
            {fabric.fabricCategory && (
              <Field label="Category" value={fabric.fabricCategory} />
            )}
            {fabric.construction && (
              <Field label="Construction" value={fabric.construction} />
            )}
            {(fabric.knitStitchType || fabric.weavePattern) && (
              <Field
                label={fabric.knitStitchType ? "Stitch" : "Weave"}
                value={fabric.knitStitchType || fabric.weavePattern || "—"}
              />
            )}
            {fabric.color && <Field label="Color" value={fabric.color} />}
            {fabric.yarnType && (
              <Field label="Yarn / Fiber" value={fabric.yarnType} />
            )}
            {fabric.weightGsm && (
              <Field label="Weight" value={`${fabric.weightGsm} gsm`} />
            )}
            {fabric.widthInches && (
              <Field label="Width" value={`${fabric.widthInches}"`} />
            )}
            {fabric.thickness && (
              <Field label="Thickness" value={`${fabric.thickness} mm`} />
            )}
            {fabric.fabricPh != null && (
              <Field label="pH" value={String(fabric.fabricPh)} />
            )}
            {fabric.endUse && (
              <Field label="End Use" value={fabric.endUse} />
            )}
            {fabric.shrinkageLength != null && (
              <Field
                label="Shrinkage L"
                value={`${fabric.shrinkageLength}%`}
              />
            )}
            {fabric.shrinkageWidth != null && (
              <Field
                label="Shrinkage W"
                value={`${fabric.shrinkageWidth}%`}
              />
            )}
          </div>
        </div>

        {/* Finish + notes */}
        {(fabric.finishNote || fabric.note) && (
          <div
            style={{
              marginTop: "0.25in",
              paddingTop: "0.15in",
              borderTop: "1px solid #e2e8f0",
            }}
          >
            <p
              style={{
                fontSize: "9pt",
                color: "#64748b",
                letterSpacing: "0.05em",
                fontWeight: 700,
                textTransform: "uppercase",
                margin: "0 0 0.1in 0",
              }}
            >
              Notes
            </p>
            {fabric.finishNote && (
              <p style={{ fontSize: "10pt", margin: "0 0 0.05in 0" }}>
                <strong>Finish:</strong> {fabric.finishNote}
              </p>
            )}
            {fabric.note && (
              <p style={{ fontSize: "10pt", margin: 0, whiteSpace: "pre-wrap" }}>
                {fabric.note}
              </p>
            )}
          </div>
        )}

        {/* Sample tally */}
        <div
          style={{
            marginTop: "0.3in",
            padding: "0.15in",
            border: "2px dashed #00b4c3",
            borderRadius: "8px",
            background: "#ecfeff",
            fontSize: "10pt",
          }}
        >
          <p style={{ fontWeight: 700, margin: "0 0 0.05in 0" }}>
            📦 Bag contents
          </p>
          <p style={{ margin: 0 }}>
            <strong>10 cut samples</strong>, each labeled{" "}
            <span
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo",
                fontWeight: 700,
              }}
            >
              {fuzeRef}
            </span>{" "}
            via the 4×6 sticker sheet (also printed). Each sticker
            carries the same identity — peel and apply to each
            individual swatch as it's bagged.
          </p>
          <p style={{ margin: "0.05in 0 0 0", fontSize: "9pt", color: "#475569" }}>
            Lab — please retain this sheet with the test record. Reference
            it back to FUZE Biotech using the FUZE# above on any report
            you issue.
          </p>
        </div>

        {/* Signature line for chain-of-custody */}
        <div
          style={{
            marginTop: "0.4in",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.3in",
            fontSize: "9pt",
            color: "#475569",
          }}
        >
          <div>
            <p style={{ borderBottom: "1px solid #94a3b8", height: "0.3in", margin: 0 }} />
            <p style={{ marginTop: "0.05in" }}>
              <strong>Shipped by</strong> · date / signature
            </p>
          </div>
          <div>
            <p style={{ borderBottom: "1px solid #94a3b8", height: "0.3in", margin: 0 }} />
            <p style={{ marginTop: "0.05in" }}>
              <strong>Received by</strong> · date / signature
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p
        style={{
          fontSize: "8pt",
          color: "#64748b",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          margin: "0 0 1pt 0",
        }}
      >
        {label}
      </p>
      <p style={{ margin: 0, fontWeight: 600 }}>{value}</p>
    </div>
  );
}
