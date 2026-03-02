"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function SOWPrintPage() {
  const { id } = useParams();
  const [sow, setSow] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/sow/${id}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setSow(j.sow);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (sow) {
      // Auto-trigger print after a brief delay for rendering
      const timer = setTimeout(() => window.print(), 600);
      return () => clearTimeout(timer);
    }
  }, [sow]);

  if (loading)
    return (
      <div className="flex items-center justify-center h-screen text-slate-400">
        Preparing SOW for print...
      </div>
    );
  if (!sow)
    return (
      <div className="flex items-center justify-center h-screen text-red-400">
        SOW not found
      </div>
    );

  let costData: any = {};
  try { costData = JSON.parse(sow.costControls || "{}"); } catch {}
  let perfData: any = {};
  try { perfData = JSON.parse(sow.performanceCriteria || "{}"); } catch {}
  let pricingData: any = {};
  try { pricingData = JSON.parse(sow.pricingTerms || "{}"); } catch {}

  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  return (
    <>
      <style jsx global>{`
        @media print {
          body { margin: 0; padding: 0; font-size: 11pt; }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
          @page { margin: 0.75in; }
        }
        @media screen {
          body { background: #f1f5f9; }
        }
      `}</style>

      {/* Screen-only toolbar */}
      <div className="no-print fixed top-0 left-0 right-0 bg-white border-b border-slate-200 p-3 flex items-center justify-between z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <a href={`/sow/${id}`} className="text-sm text-blue-600 hover:underline">
            &larr; Back to SOW
          </a>
          <span className="text-sm text-slate-400">Print Preview</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
          >
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* Print content */}
      <div className="max-w-[800px] mx-auto bg-white shadow-lg my-16 print:my-0 print:shadow-none print:max-w-none">
        <div className="p-10 print:p-0">
          {/* Header */}
          <div className="text-center mb-8 pb-6 border-b-2 border-slate-800">
            {/* Inline logo for print */}
            <div className="flex justify-center mb-2">
              <svg width="40" height="40" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M24 2L6 10v14c0 11.1 7.7 21.5 18 24 10.3-2.5 18-12.9 18-24V10L24 2z" fill="#1d4ed8" />
                <path d="M16 14h16v4H21v4h9v4h-9v8h-5V14z" fill="white" />
              </svg>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              FUZE TECHNOLOGIES
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Commercialization & Development Scope of Work
            </p>
            <div className="mt-3 inline-block px-4 py-1 bg-slate-100 rounded-full">
              <span className="text-xs font-bold text-slate-600">
                Status: {sow.status}
              </span>
            </div>
          </div>

          {/* SOW Title & Meta */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">
              {sow.title || "Untitled SOW"}
            </h2>
            <div className="flex gap-6 mt-2 text-sm text-slate-500">
              <span>Brand: <strong className="text-slate-900">{sow.brand?.name || "—"}</strong></span>
              <span>Date: <strong className="text-slate-900">{today}</strong></span>
              <span>SOW ID: <strong className="text-slate-900 font-mono text-xs">{sow.id}</strong></span>
            </div>
          </div>

          {/* Products */}
          {sow.products?.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-bold text-slate-800 mb-2 uppercase tracking-wide">
                Products / SKUs
              </h3>
              <table className="w-full text-sm border border-slate-300">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left px-3 py-2 border-b border-slate-300 font-semibold text-slate-600">Product</th>
                    <th className="text-left px-3 py-2 border-b border-slate-300 font-semibold text-slate-600">Type</th>
                    <th className="text-left px-3 py-2 border-b border-slate-300 font-semibold text-slate-600">SKU</th>
                  </tr>
                </thead>
                <tbody>
                  {sow.products.map((sp: any) => (
                    <tr key={sp.id} className="border-b border-slate-200">
                      <td className="px-3 py-2 font-semibold">{sp.product.name}</td>
                      <td className="px-3 py-2 text-slate-600">{sp.product.productType || "—"}</td>
                      <td className="px-3 py-2 font-mono text-xs">{sp.product.sku || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Section 1: Commercial Ownership */}
          <Section title="1. Commercial Ownership">
            <Row label="Brand" value={sow.brand?.name} />
            <Row label="Executive Sponsor" value={costData.executiveSponsor} />
            <Row label="Sales Representative" value={costData.salesRepName} />
          </Section>

          {/* Section 2: End Use Definition */}
          <Section title="2. End Use Definition">
            {costData.garmentSku && <Row label="Garment SKU / Style #" value={costData.garmentSku} />}
            <Row label="Fabric Type" value={costData.fabricType} />
            <Row label="GSM" value={costData.gsm} />
            <Row label="Application Level" value={costData.applicationLevel ? `${costData.applicationLevel} mg/kg` : null} />
            <Row label="Target Launch Season" value={costData.targetLaunchSeason} />
            <Row label="Retail Channel" value={costData.retailChannel} />
          </Section>

          {/* Section 3: Volume Forecast */}
          <Section title="3. Volume Forecast">
            <Row label="Projected Annual Units" value={costData.projectedAnnualUnits ? Number(costData.projectedAnnualUnits).toLocaleString() : null} />
            <Row label="Garment Weight" value={costData.garmentWeight ? `${costData.garmentWeight} kg` : null} />
            <Row label="Calculated Annual Liters" value={costData.calculatedAnnualLiters ? `${Number(costData.calculatedAnnualLiters).toLocaleString()} L` : null} />
            <Row label="Projected Annual Revenue" value={pricingData.projectedAnnualRevenue ? `$${Number(pricingData.projectedAnnualRevenue).toLocaleString()}` : null} />
            <Row label="Target Commercialization Date" value={costData.targetCommercializationDate} />
          </Section>

          {/* Section 4: Success Criteria */}
          <Section title="4. Success Criteria">
            <Row label="ICP Target" value={perfData.icpTarget} />
            <Row label="Antimicrobial Standard" value={perfData.antimicrobialStandard} />
            <Row label="Required Log Reduction" value={perfData.requiredLogReduction} />
            <Row label="Wash Durability" value={perfData.washDurability} />
            <Row label="Approved Testing Lab" value={perfData.approvedTestingLab} />
          </Section>

          {/* Section 5: Financial Participation */}
          <Section title="5. Financial Participation">
            <Row label="Participation Type" value={pricingData.financialParticipation?.replace(/_/g, " ")} />
            {pricingData.developmentRetainer && (
              <Row label="Development Retainer" value={`$${Number(pricingData.developmentRetainer).toLocaleString()}`} />
            )}
            <Row label="Commitment Volume" value={pricingData.commitmentVolumeLiters ? `${Number(pricingData.commitmentVolumeLiters).toLocaleString()} L` : null} />
          </Section>

          {/* Commercialization Commitment */}
          <div className="my-6 p-4 border-2 border-slate-800 rounded-lg">
            <h3 className="text-sm font-bold text-slate-900 mb-2">
              COMMERCIALIZATION COMMITMENT
            </h3>
            <p className="text-sm text-slate-700 leading-relaxed">
              Upon successful completion of all technical validation criteria outlined in
              this Scope of Work, the undersigned parties intend to proceed with
              commercialization within six (6) months, subject to the projected annual
              volume of {costData.calculatedAnnualLiters ? `${Number(costData.calculatedAnnualLiters).toLocaleString()} liters` : "TBD"} and
              commitment volume of {pricingData.commitmentVolumeLiters ? `${Number(pricingData.commitmentVolumeLiters).toLocaleString()} liters` : "TBD"}.
            </p>
          </div>

          {/* Stage-Gate Milestones */}
          {sow.milestones?.length > 0 && (
            <div className="my-6">
              <h3 className="text-sm font-bold text-slate-800 mb-2 uppercase tracking-wide">
                Stage-Gate Milestones
              </h3>
              <table className="w-full text-sm border border-slate-300">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left px-3 py-2 border-b border-slate-300 font-semibold text-slate-600 w-12">Stage</th>
                    <th className="text-left px-3 py-2 border-b border-slate-300 font-semibold text-slate-600">Milestone</th>
                    <th className="text-left px-3 py-2 border-b border-slate-300 font-semibold text-slate-600">Description</th>
                    <th className="text-left px-3 py-2 border-b border-slate-300 font-semibold text-slate-600 w-24">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sow.milestones.map((m: any, i: number) => (
                    <tr key={m.id} className="border-b border-slate-200">
                      <td className="px-3 py-2 font-bold text-center">{i}</td>
                      <td className="px-3 py-2 font-semibold">{m.title}</td>
                      <td className="px-3 py-2 text-slate-600">{m.description}</td>
                      <td className="px-3 py-2">
                        {m.completedAt ? (
                          <span className="text-green-700 font-semibold">Complete</span>
                        ) : (
                          <span className="text-slate-400">Pending</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Signature Block */}
          <div className="page-break" />
          <div className="mt-8 pt-6 border-t-2 border-slate-800">
            <h3 className="text-sm font-bold text-slate-800 mb-6 uppercase tracking-wide">
              Signatures
            </h3>

            <div className="grid grid-cols-2 gap-8">
              {/* FUZE Technologies */}
              <div>
                <p className="text-xs font-bold text-slate-500 mb-6">
                  FUZE TECHNOLOGIES
                </p>
                <div className="border-b border-slate-400 mb-1 h-12" />
                <p className="text-xs text-slate-500">Signature</p>
                <div className="mt-4 border-b border-slate-400 mb-1 h-6" />
                <p className="text-xs text-slate-500">Print Name</p>
                <div className="mt-4 border-b border-slate-400 mb-1 h-6" />
                <p className="text-xs text-slate-500">Title</p>
                <div className="mt-4 border-b border-slate-400 mb-1 h-6" />
                <p className="text-xs text-slate-500">Date</p>
              </div>

              {/* Customer/Brand */}
              <div>
                <p className="text-xs font-bold text-slate-500 mb-6">
                  {sow.brand?.name?.toUpperCase() || "CUSTOMER"}
                </p>
                <div className="border-b border-slate-400 mb-1 h-12" />
                <p className="text-xs text-slate-500">Signature</p>
                <div className="mt-4 border-b border-slate-400 mb-1 h-6" />
                <p className="text-xs text-slate-500">
                  Print Name
                  {sow.signatory && (
                    <span className="text-slate-700 font-semibold ml-2">{sow.signatory}</span>
                  )}
                </p>
                <div className="mt-4 border-b border-slate-400 mb-1 h-6" />
                <p className="text-xs text-slate-500">
                  Title
                  {sow.signatoryTitle && (
                    <span className="text-slate-700 font-semibold ml-2">{sow.signatoryTitle}</span>
                  )}
                </p>
                <div className="mt-4 border-b border-slate-400 mb-1 h-6" />
                <p className="text-xs text-slate-500">Date</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-12 pt-4 border-t border-slate-200 text-center">
            <p className="text-[10px] text-slate-400">
              FUZE Technologies — Confidential — {today}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="text-sm font-bold text-slate-800 mb-2 uppercase tracking-wide border-b border-slate-200 pb-1">
        {title}
      </h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between text-sm py-0.5">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}
