// @ts-nocheck
"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface DistDoc {
  id: string;
  docType: string;
  title: string;
  description?: string;
  shipmentRef?: string;
  batchNumber?: string;
  poNumber?: string;
  portOfOrigin?: string;
  portOfDest?: string;
  hsCode?: string;
  expiresAt?: string;
  createdAt: string;
  distributor?: {
    name: string;
    country?: string;
    region?: string;
    contactName?: string;
    contactEmail?: string;
    phone?: string;
    address?: string;
  };
  factory?: {
    name: string;
    country?: string;
    city?: string;
    address?: string;
  };
}

/* ─────────────────────────────────────────────
 * Printable Document Templates
 * Renders a professional, print-ready layout
 * for C of A, BOL, Commercial Invoice, etc.
 * ───────────────────────────────────────────── */
export default function PrintDocumentPage() {
  const { id } = useParams();
  const [doc, setDoc] = useState<DistDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/admin/distributor-docs/${id}`);
        const data = await res.json();
        if (data.ok) setDoc(data.document);
        else setError(data.error || "Failed to load document");
      } catch {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-500 font-bold">{error || "Document not found"}</p>
      </div>
    );
  }

  const docDate = new Date(doc.createdAt).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
  const expiryDate = doc.expiresAt
    ? new Date(doc.expiresAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : null;

  // Render the appropriate template
  const renderTemplate = () => {
    switch (doc.docType) {
      case "CERTIFICATE_OF_ANALYSIS":
        return <CertificateOfAnalysis doc={doc} docDate={docDate} expiryDate={expiryDate} />;
      case "BILL_OF_LADING":
        return <BillOfLading doc={doc} docDate={docDate} />;
      case "COMMERCIAL_INVOICE":
        return <CommercialInvoice doc={doc} docDate={docDate} />;
      default:
        return <GenericDocument doc={doc} docDate={docDate} expiryDate={expiryDate} />;
    }
  };

  return (
    <>
      {/* Print controls — hidden when printing */}
      <div className="print:hidden fixed top-0 left-0 right-0 bg-slate-800 text-white px-6 py-3 flex items-center justify-between z-50">
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm">FUZE Atlas — Document Preview</span>
          <span className="text-slate-400 text-xs">{doc.title}</span>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => window.print()}
            className="px-4 py-1.5 bg-[#00b4c3] text-white rounded-lg font-semibold text-sm hover:bg-[#009ba8]"
          >
            Print / Save PDF
          </button>
          <button
            onClick={() => window.close()}
            className="px-4 py-1.5 bg-slate-600 text-white rounded-lg text-sm hover:bg-slate-500"
          >
            Close
          </button>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            margin: 0.75in;
            size: letter;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <div className="print:mt-0 mt-14">
        {renderTemplate()}
      </div>
    </>
  );
}

/* ─── FUZE DOCUMENT HEADER ─── */
function FuzeHeader({ title, docNumber }: { title: string; docNumber: string }) {
  return (
    <div className="border-b-2 border-slate-800 pb-4 mb-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900" style={{ fontFamily: "system-ui" }}>
            FUZE
          </h1>
          <p className="text-[10px] text-slate-500 tracking-widest uppercase mt-0.5">
            Biotech · Antimicrobial Technology
          </p>
        </div>
        <div className="text-right">
          <h2 className="text-lg font-bold text-slate-800 uppercase tracking-wide">{title}</h2>
          <p className="text-xs text-slate-500 mt-1">Document #: {docNumber}</p>
        </div>
      </div>
      <div className="mt-3 text-[10px] text-slate-400">
        FUZE Biotech Inc. · 1625 W 820 N, Provo, UT 84601, USA · contact@fuzebiotech.com · +1 (801) 710-7222
      </div>
    </div>
  );
}

/* ─── FUZE FOOTER ─── */
function FuzeFooter({ docNumber }: { docNumber: string }) {
  return (
    <div className="mt-12 pt-4 border-t border-slate-300">
      <div className="flex justify-between text-[9px] text-slate-400">
        <span>FUZE Biotech Inc. — Confidential</span>
        <span>Document #: {docNumber}</span>
        <span>Generated: {new Date().toLocaleDateString("en-US")}</span>
      </div>
    </div>
  );
}

/* ─── INFO ROW ─── */
function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex py-1.5 border-b border-slate-100">
      <span className="w-40 flex-shrink-0 text-xs font-semibold text-slate-500 uppercase">{label}</span>
      <span className="text-sm text-slate-800">{value}</span>
    </div>
  );
}

/* ════════════════════════════════════════════════════
 * CERTIFICATE OF ANALYSIS (C of A)
 * ════════════════════════════════════════════════════ */
function CertificateOfAnalysis({ doc, docDate, expiryDate }: { doc: DistDoc; docDate: string; expiryDate: string | null }) {
  const docNumber = `COA-${doc.batchNumber || doc.id.slice(-8).toUpperCase()}`;

  return (
    <div className="max-w-[8.5in] mx-auto bg-white p-8 print:p-0 min-h-screen">
      <FuzeHeader title="Certificate of Analysis" docNumber={docNumber} />

      {/* Distributor & Factory Info */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Issued To</h3>
          <div className="text-sm text-slate-800 space-y-0.5">
            <p className="font-bold text-base">{doc.distributor?.name || "—"}</p>
            {doc.distributor?.address && <p>{doc.distributor.address}</p>}
            {doc.distributor?.country && <p>{doc.distributor.country}</p>}
            {doc.distributor?.contactName && <p className="mt-1 text-slate-500">Attn: {doc.distributor.contactName}</p>}
          </div>
        </div>
        {doc.factory && (
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Manufacturing Origin</h3>
            <div className="text-sm text-slate-800 space-y-0.5">
              <p className="font-bold text-base">{doc.factory.name}</p>
              {doc.factory.address && <p>{doc.factory.address}</p>}
              {(doc.factory.city || doc.factory.country) && (
                <p>{[doc.factory.city, doc.factory.country].filter(Boolean).join(", ")}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Document Details */}
      <div className="mb-8">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Certificate Details</h3>
        <div className="bg-slate-50 rounded-lg p-4">
          <InfoRow label="Certificate Title" value={doc.title} />
          <InfoRow label="Batch Number" value={doc.batchNumber} />
          <InfoRow label="PO Number" value={doc.poNumber} />
          <InfoRow label="Date of Issue" value={docDate} />
          {expiryDate && <InfoRow label="Valid Until" value={expiryDate} />}
          <InfoRow label="HS Code" value={doc.hsCode} />
        </div>
      </div>

      {/* Product Description */}
      <div className="mb-8">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Product Information</h3>
        <div className="bg-slate-50 rounded-lg p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 text-xs font-bold text-slate-500 uppercase">Parameter</th>
                <th className="text-left py-2 text-xs font-bold text-slate-500 uppercase">Specification</th>
                <th className="text-left py-2 text-xs font-bold text-slate-500 uppercase">Result</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-2 text-slate-700">Product Name</td>
                <td className="py-2 text-slate-700">FUZE High Density Allotrope</td>
                <td className="py-2 text-slate-700 font-semibold">Conforms</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 text-slate-700">Active Ingredient</td>
                <td className="py-2 text-slate-700">High Density Allotrope (Ag)</td>
                <td className="py-2 text-slate-700 font-semibold">Conforms</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 text-slate-700">Mode of Action</td>
                <td className="py-2 text-slate-700">Sulfur Sequestration / Disulfide Bond Elimination</td>
                <td className="py-2 text-slate-700 font-semibold">Confirmed</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 text-slate-700">Appearance</td>
                <td className="py-2 text-slate-700">Clear to slight amber liquid</td>
                <td className="py-2 text-slate-700 font-semibold">Conforms</td>
              </tr>
              <tr>
                <td className="py-2 text-slate-700">Concentration (Stock)</td>
                <td className="py-2 text-slate-700">30 mg/L nominal</td>
                <td className="py-2 text-slate-700 font-semibold">Conforms</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Description / Notes */}
      {doc.description && (
        <div className="mb-8">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Notes</h3>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{doc.description}</p>
        </div>
      )}

      {/* Certification Statement */}
      <div className="mb-8 p-4 border-l-4 border-[#00b4c3] bg-[#00b4c3]/5">
        <p className="text-sm text-slate-700">
          This is to certify that the above referenced product meets all stated specifications
          and has been manufactured and tested in accordance with FUZE Biotech quality standards.
          The product referenced in this certificate conforms to applicable regulatory requirements.
        </p>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-12 mt-12">
        <div>
          <div className="border-b border-slate-400 pb-1 mb-1 h-10" />
          <p className="text-xs text-slate-500">Authorized Signature</p>
          <p className="text-xs text-slate-400 mt-0.5">FUZE Biotech Quality Assurance</p>
        </div>
        <div>
          <div className="border-b border-slate-400 pb-1 mb-1 h-10" />
          <p className="text-xs text-slate-500">Date</p>
        </div>
      </div>

      <FuzeFooter docNumber={docNumber} />
    </div>
  );
}

/* ════════════════════════════════════════════════════
 * BILL OF LADING (BOL)
 * ════════════════════════════════════════════════════ */
function BillOfLading({ doc, docDate }: { doc: DistDoc; docDate: string }) {
  const docNumber = `BOL-${doc.shipmentRef || doc.id.slice(-8).toUpperCase()}`;

  return (
    <div className="max-w-[8.5in] mx-auto bg-white p-8 print:p-0 min-h-screen">
      <FuzeHeader title="Bill of Lading" docNumber={docNumber} />

      {/* Shipper & Consignee */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div className="border border-slate-200 rounded-lg p-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Shipper / Exporter</h3>
          <div className="text-sm text-slate-800 space-y-0.5">
            <p className="font-bold">FUZE Biotech Inc.</p>
            <p>1625 W 820 N</p>
            <p>Provo, UT 84601, USA</p>
            <p className="text-slate-500 mt-1">Tel: +1 (801) 710-7222</p>
          </div>
        </div>
        <div className="border border-slate-200 rounded-lg p-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Consignee</h3>
          <div className="text-sm text-slate-800 space-y-0.5">
            <p className="font-bold">{doc.distributor?.name || "—"}</p>
            {doc.distributor?.address && <p>{doc.distributor.address}</p>}
            {doc.distributor?.country && <p>{doc.distributor.country}</p>}
            {doc.distributor?.contactName && <p className="text-slate-500 mt-1">Attn: {doc.distributor.contactName}</p>}
            {doc.distributor?.phone && <p className="text-slate-500">Tel: {doc.distributor.phone}</p>}
          </div>
        </div>
      </div>

      {/* Routing Details */}
      <div className="mb-8">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Routing & Shipment Details</h3>
        <div className="bg-slate-50 rounded-lg p-4">
          <InfoRow label="Shipment Date" value={docDate} />
          <InfoRow label="Tracking / Ref #" value={doc.shipmentRef} />
          <InfoRow label="PO Number" value={doc.poNumber} />
          <InfoRow label="Port of Origin" value={doc.portOfOrigin} />
          <InfoRow label="Port of Destination" value={doc.portOfDest} />
          <InfoRow label="HS Code" value={doc.hsCode} />
        </div>
      </div>

      {/* Cargo Description */}
      <div className="mb-8">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Description of Goods</h3>
        <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
          <thead className="bg-slate-100">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-bold text-slate-600 uppercase">Item</th>
              <th className="text-left px-4 py-2 text-xs font-bold text-slate-600 uppercase">Description</th>
              <th className="text-left px-4 py-2 text-xs font-bold text-slate-600 uppercase">HS Code</th>
              <th className="text-left px-4 py-2 text-xs font-bold text-slate-600 uppercase">Batch</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-slate-200">
              <td className="px-4 py-3 text-slate-700">1</td>
              <td className="px-4 py-3 text-slate-700">
                <p className="font-semibold">{doc.title}</p>
                {doc.description && <p className="text-xs text-slate-500 mt-0.5">{doc.description}</p>}
              </td>
              <td className="px-4 py-3 text-slate-700 font-mono text-xs">{doc.hsCode || "—"}</td>
              <td className="px-4 py-3 text-slate-700 font-mono text-xs">{doc.batchNumber || "—"}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Additional factory info */}
      {doc.factory && (
        <div className="mb-8">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Manufacturing Origin</h3>
          <div className="bg-slate-50 rounded-lg p-4">
            <InfoRow label="Factory" value={doc.factory.name} />
            <InfoRow label="Location" value={[doc.factory.city, doc.factory.country].filter(Boolean).join(", ")} />
          </div>
        </div>
      )}

      {/* Terms */}
      <div className="mb-8 p-4 bg-slate-50 rounded-lg text-xs text-slate-600">
        <p className="font-semibold text-slate-700 mb-1">Terms & Conditions:</p>
        <p>
          RECEIVED in apparent good order and condition, the goods described above,
          to be transported to the destination indicated. The carrier shall not be liable
          for loss or damage arising from circumstances beyond the carrier's control.
          This Bill of Lading is subject to the terms and conditions on file with FUZE Biotech Inc.
        </p>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-3 gap-8 mt-12">
        <div>
          <div className="border-b border-slate-400 pb-1 mb-1 h-10" />
          <p className="text-xs text-slate-500">Shipper Signature</p>
        </div>
        <div>
          <div className="border-b border-slate-400 pb-1 mb-1 h-10" />
          <p className="text-xs text-slate-500">Carrier Signature</p>
        </div>
        <div>
          <div className="border-b border-slate-400 pb-1 mb-1 h-10" />
          <p className="text-xs text-slate-500">Consignee Signature</p>
        </div>
      </div>

      <FuzeFooter docNumber={docNumber} />
    </div>
  );
}

/* ════════════════════════════════════════════════════
 * COMMERCIAL INVOICE
 * ════════════════════════════════════════════════════ */
function CommercialInvoice({ doc, docDate }: { doc: DistDoc; docDate: string }) {
  const docNumber = `INV-${doc.poNumber || doc.id.slice(-8).toUpperCase()}`;

  return (
    <div className="max-w-[8.5in] mx-auto bg-white p-8 print:p-0 min-h-screen">
      <FuzeHeader title="Commercial Invoice" docNumber={docNumber} />

      {/* Seller & Buyer */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div className="border border-slate-200 rounded-lg p-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Seller / Exporter</h3>
          <div className="text-sm text-slate-800 space-y-0.5">
            <p className="font-bold">FUZE Biotech Inc.</p>
            <p>1625 W 820 N</p>
            <p>Provo, UT 84601, USA</p>
            <p className="text-slate-500 mt-1">EIN: [To be completed]</p>
          </div>
        </div>
        <div className="border border-slate-200 rounded-lg p-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Buyer / Importer</h3>
          <div className="text-sm text-slate-800 space-y-0.5">
            <p className="font-bold">{doc.distributor?.name || "—"}</p>
            {doc.distributor?.address && <p>{doc.distributor.address}</p>}
            {doc.distributor?.country && <p>{doc.distributor.country}</p>}
            {doc.distributor?.contactName && <p className="text-slate-500 mt-1">Attn: {doc.distributor.contactName}</p>}
            {doc.distributor?.contactEmail && <p className="text-slate-500">{doc.distributor.contactEmail}</p>}
          </div>
        </div>
      </div>

      {/* Invoice Details */}
      <div className="mb-8">
        <div className="bg-slate-50 rounded-lg p-4">
          <InfoRow label="Invoice Number" value={docNumber} />
          <InfoRow label="Invoice Date" value={docDate} />
          <InfoRow label="PO Number" value={doc.poNumber} />
          <InfoRow label="Shipment Ref" value={doc.shipmentRef} />
          <InfoRow label="Port of Origin" value={doc.portOfOrigin} />
          <InfoRow label="Port of Destination" value={doc.portOfDest} />
          <InfoRow label="Terms" value="Net 30" />
          <InfoRow label="Currency" value="USD" />
        </div>
      </div>

      {/* Line Items */}
      <div className="mb-8">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Invoice Line Items</h3>
        <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
          <thead className="bg-slate-100">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-bold text-slate-600 uppercase w-12">#</th>
              <th className="text-left px-4 py-2 text-xs font-bold text-slate-600 uppercase">Description</th>
              <th className="text-left px-4 py-2 text-xs font-bold text-slate-600 uppercase">HS Code</th>
              <th className="text-left px-4 py-2 text-xs font-bold text-slate-600 uppercase">Batch</th>
              <th className="text-right px-4 py-2 text-xs font-bold text-slate-600 uppercase">Qty</th>
              <th className="text-right px-4 py-2 text-xs font-bold text-slate-600 uppercase">Unit Price</th>
              <th className="text-right px-4 py-2 text-xs font-bold text-slate-600 uppercase">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-slate-200">
              <td className="px-4 py-3 text-slate-700">1</td>
              <td className="px-4 py-3 text-slate-700">
                <p className="font-semibold">{doc.title}</p>
                {doc.description && <p className="text-xs text-slate-500 mt-0.5">{doc.description}</p>}
              </td>
              <td className="px-4 py-3 text-slate-700 font-mono text-xs">{doc.hsCode || "—"}</td>
              <td className="px-4 py-3 text-slate-700 font-mono text-xs">{doc.batchNumber || "—"}</td>
              <td className="px-4 py-3 text-right text-slate-700">[qty]</td>
              <td className="px-4 py-3 text-right text-slate-700">[price]</td>
              <td className="px-4 py-3 text-right font-semibold text-slate-800">[total]</td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 bg-slate-50">
              <td colSpan={6} className="px-4 py-3 text-right text-sm font-bold text-slate-700">TOTAL (USD)</td>
              <td className="px-4 py-3 text-right text-lg font-black text-slate-900">[total]</td>
            </tr>
          </tfoot>
        </table>
        <p className="text-[10px] text-slate-400 mt-2 italic">
          Note: Quantity, unit price, and total amounts are to be completed prior to finalizing this invoice.
        </p>
      </div>

      {/* Declaration */}
      <div className="mb-8 p-4 border-l-4 border-[#00b4c3] bg-[#00b4c3]/5 text-sm text-slate-700">
        <p className="font-semibold mb-1">Declaration:</p>
        <p>
          I/We hereby certify that the information contained in this invoice is true and correct,
          and that the contents and value of this shipment are as stated above. The goods originate
          from the United States of America.
        </p>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-12 mt-12">
        <div>
          <div className="border-b border-slate-400 pb-1 mb-1 h-10" />
          <p className="text-xs text-slate-500">Authorized Signature</p>
          <p className="text-xs text-slate-400 mt-0.5">FUZE Biotech Inc.</p>
        </div>
        <div>
          <div className="border-b border-slate-400 pb-1 mb-1 h-10" />
          <p className="text-xs text-slate-500">Date</p>
        </div>
      </div>

      <FuzeFooter docNumber={docNumber} />
    </div>
  );
}

/* ════════════════════════════════════════════════════
 * GENERIC DOCUMENT (Packing List, Customs, SDS, etc.)
 * ════════════════════════════════════════════════════ */
function GenericDocument({ doc, docDate, expiryDate }: { doc: DistDoc; docDate: string; expiryDate: string | null }) {
  const typeLabels: Record<string, string> = {
    PACKING_LIST: "Packing List",
    CUSTOMS_DECLARATION: "Customs Declaration",
    IMPORT_PERMIT: "Import Permit",
    EXPORT_PERMIT: "Export Permit",
    PHYTOSANITARY_CERT: "Phytosanitary Certificate",
    INSURANCE_CERT: "Insurance Certificate",
    SDS_MSDS: "Safety Data Sheet",
    OTHER: "Document",
  };

  const docTitle = typeLabels[doc.docType] || "Document";
  const docNumber = `DOC-${doc.id.slice(-8).toUpperCase()}`;

  return (
    <div className="max-w-[8.5in] mx-auto bg-white p-8 print:p-0 min-h-screen">
      <FuzeHeader title={docTitle} docNumber={docNumber} />

      {/* Parties */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">From</h3>
          <div className="text-sm text-slate-800">
            <p className="font-bold">FUZE Biotech Inc.</p>
            <p>1625 W 820 N, Provo, UT 84601, USA</p>
          </div>
        </div>
        <div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">To</h3>
          <div className="text-sm text-slate-800">
            <p className="font-bold">{doc.distributor?.name || "—"}</p>
            {doc.distributor?.address && <p>{doc.distributor.address}</p>}
            {doc.distributor?.country && <p>{doc.distributor.country}</p>}
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="mb-8">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Document Details</h3>
        <div className="bg-slate-50 rounded-lg p-4">
          <InfoRow label="Title" value={doc.title} />
          <InfoRow label="Date Issued" value={docDate} />
          {expiryDate && <InfoRow label="Expiry Date" value={expiryDate} />}
          <InfoRow label="Batch Number" value={doc.batchNumber} />
          <InfoRow label="PO Number" value={doc.poNumber} />
          <InfoRow label="Shipment Ref" value={doc.shipmentRef} />
          <InfoRow label="Port of Origin" value={doc.portOfOrigin} />
          <InfoRow label="Port of Destination" value={doc.portOfDest} />
          <InfoRow label="HS Code" value={doc.hsCode} />
          {doc.factory && <InfoRow label="Factory" value={`${doc.factory.name}${doc.factory.country ? `, ${doc.factory.country}` : ""}`} />}
        </div>
      </div>

      {/* Description */}
      {doc.description && (
        <div className="mb-8">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Description / Notes</h3>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{doc.description}</p>
        </div>
      )}

      {/* Signature */}
      <div className="mt-12">
        <div className="max-w-xs">
          <div className="border-b border-slate-400 pb-1 mb-1 h-10" />
          <p className="text-xs text-slate-500">Authorized Signature</p>
          <p className="text-xs text-slate-400 mt-0.5">FUZE Biotech Inc.</p>
        </div>
      </div>

      <FuzeFooter docNumber={docNumber} />
    </div>
  );
}
