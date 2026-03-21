// @ts-nocheck
"use client";
import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/Toast";

/* ── Default data for forms ── */
const DEFAULT_FUZE_SENDER = {
  company: "Fuze Biotech",
  address1: "1895 W 2100 S",
  address2: "Salt Lake City, UT 84119 USA",
  country: "",
};

const EMPTY_ADDRESS = {
  company: "",
  address1: "",
  address2: "",
  address3: "",
  address4: "",
  country: "",
  postalCode: "",
};

const EMPTY_LINE_ITEM = { activity: "", qty: 0, rate: 0, unit: "lt" };

const DOC_TYPES = [
  { id: "sales_contract", label: "Sales Contract", icon: "\u{1F4DD}", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { id: "invoice", label: "Invoice", icon: "\u{1F9FE}", color: "bg-green-50 text-green-700 border-green-200" },
  { id: "packing_list", label: "Packing List", icon: "\u{1F4E6}", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { id: "cofa", label: "Certificate of Analysis", icon: "\u{1F52C}", color: "bg-violet-50 text-violet-700 border-violet-200" },
];

export default function ShippingDocsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState("sales_contract");
  const [generating, setGenerating] = useState(false);

  // ── Shared fields ──
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [docDate, setDocDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [terms, setTerms] = useState("50% - Before Shipment\n50% - 60 days After Shipment");
  const [incoterm, setIncoterm] = useState("CIF Shanghai");
  const [currency, setCurrency] = useState("USD");
  const [billTo, setBillTo] = useState({ ...EMPTY_ADDRESS });
  const [shipTo, setShipTo] = useState({ ...EMPTY_ADDRESS });
  const [lineItems, setLineItems] = useState([{ activity: "Nanoparticles:FUZE F1 Silver Particle Solution by Liter (DS)", qty: 0, rate: 19.50, unit: "lt" }]);
  const [notes, setNotes] = useState("");

  // ── Packing List fields ──
  const [containers, setContainers] = useState("20 Gaylords Each-");
  const [dimensions, setDimensions] = useState("121.92 cm x 101.6 cm x 114.3 cm");
  const [netWeight, setNetWeight] = useState("");
  const [grossWeight, setGrossWeight] = useState("");

  // ── CofA fields ──
  const [product, setProduct] = useState("Fuze F1");
  const [productDescription, setProductDescription] = useState("Silver Nanoparticles in Distilled Water");
  const [lotNumber, setLotNumber] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [concentration, setConcentration] = useState("30 ppm");
  const [concentrationRange, setConcentrationRange] = useState("25-40 ppm");
  const [particleSize, setParticleSize] = useState("8 nm");
  const [sizeRange, setSizeRange] = useState("1-10 nm");
  const [appearance, setAppearance] = useState("Deep orange-yellow");
  const [antibacterial, setAntibacterial] = useState("Pass");
  const [fungal, setFungal] = useState("N/A");
  const [retestBy, setRetestBy] = useState("");
  const [expiration, setExpiration] = useState("");
  const [otherNotes, setOtherNotes] = useState("Recommended to shake mixture prior to use.");

  const copyBillToShip = () => setShipTo({ ...billTo });

  const addLineItem = () => setLineItems([...lineItems, { ...EMPTY_LINE_ITEM }]);
  const removeLineItem = (idx: number) => setLineItems(lineItems.filter((_, i) => i !== idx));
  const updateLineItem = (idx: number, field: string, value: any) => {
    const updated = [...lineItems];
    updated[idx] = { ...updated[idx], [field]: value };
    setLineItems(updated);
  };

  const totalAmount = lineItems.reduce((s, i) => s + (i.qty * (i.rate || 0)), 0);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      let payload: any;

      if (activeTab === "cofa") {
        if (!lotNumber) { toast.error("Lot number is required"); return; }
        payload = {
          docType: "cofa",
          product,
          productDescription,
          lotNumber,
          deliveryDate,
          concentration,
          concentrationRange,
          size: particleSize,
          sizeRange,
          additives: "N/A",
          appearance,
          antibacterial,
          fungal,
          retestBy,
          expiration,
          otherNotes,
        };
      } else {
        if (!invoiceNumber) { toast.error("Invoice number is required"); return; }
        if (!billTo.company) { toast.error("Bill To company is required"); return; }

        const base = {
          invoiceNumber,
          date: formatDateForPdf(docDate),
          billTo,
          shipTo: shipTo.company ? shipTo : billTo,
          lineItems,
        };

        if (activeTab === "sales_contract") {
          payload = {
            ...base,
            docType: "sales_contract",
            dueDate: formatDateForPdf(dueDate),
            terms: terms.replace(/\n/g, "\n"),
            incoterm,
            notes,
            currency,
          };
        } else if (activeTab === "invoice") {
          payload = {
            ...base,
            docType: "invoice",
            dueDate: formatDateForPdf(dueDate),
            terms: terms.replace(/\n/g, "\n"),
            currency,
          };
        } else if (activeTab === "packing_list") {
          payload = {
            ...base,
            docType: "packing_list",
            date: formatDateForPdf(docDate),
            containers,
            dimensions,
            netWeight,
            grossWeight,
          };
        }
      }

      const res = await fetch("/api/shipping-docs/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Generation failed" }));
        throw new Error(err.error || "Generation failed");
      }

      // Open PDF in new tab
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      toast.success("Document generated — opening in new tab");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate document");
    } finally {
      setGenerating(false);
    }
  };

  const formatDateForPdf = (d: string) => {
    if (!d) return "";
    const parts = d.split("-");
    if (parts.length === 3) return `${parts[1]}/${parts[2]}/${parts[0]}`;
    return d;
  };

  const isInternal = user?.role === "ADMIN" || user?.role === "EMPLOYEE" || user?.role === "SALES_MANAGER" || user?.role === "SALES_REP";

  if (!isInternal) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p className="text-4xl mb-4">{"\u{1F512}"}</p>
        <p>Shipping document generation is available to internal users only.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Shipping Documents</h1>
        <p className="text-slate-500 text-sm mt-0.5">Generate sales contracts, invoices, packing lists & certificates of analysis</p>
      </div>

      {/* Document Type Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {DOC_TYPES.map((dt) => (
          <button
            key={dt.id}
            onClick={() => setActiveTab(dt.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
              activeTab === dt.id
                ? "bg-[#00b4c3]/10 border-[#00b4c3] text-[#00b4c3] ring-1 ring-[#00b4c3]/20"
                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
            }`}
          >
            <span>{dt.icon}</span>
            {dt.label}
          </button>
        ))}
      </div>

      {/* Form */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="p-6 space-y-6">

          {/* ── CofA Form ── */}
          {activeTab === "cofa" ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Product" value={product} onChange={setProduct} />
                <Field label="Lot #" value={lotNumber} onChange={setLotNumber} placeholder="e.g. F1-133" required />
              </div>
              <Field label="Product Description" value={productDescription} onChange={setProductDescription} />
              <Field label="Delivery Date" type="date" value={deliveryDate} onChange={setDeliveryDate} />

              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Physical Attributes</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Concentration Result" value={concentration} onChange={setConcentration} placeholder="30 ppm" />
                  <Field label="Concentration Range" value={concentrationRange} onChange={setConcentrationRange} placeholder="25-40 ppm" />
                  <Field label="Size Result" value={particleSize} onChange={setParticleSize} placeholder="8 nm" />
                  <Field label="Size Range" value={sizeRange} onChange={setSizeRange} placeholder="1-10 nm" />
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Quality Results</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Appearance" value={appearance} onChange={setAppearance} />
                  <Field label="Antibacterial" value={antibacterial} onChange={setAntibacterial} />
                  <Field label="Fungal" value={fungal} onChange={setFungal} />
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Expiration</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Retest By" value={retestBy} onChange={setRetestBy} placeholder="e.g. 06/30/27" />
                  <Field label="Expiration Date" value={expiration} onChange={setExpiration} placeholder="e.g. 08/14/35" />
                </div>
              </div>

              <Field label="Other Notes" value={otherNotes} onChange={setOtherNotes} multiline />
            </>
          ) : (
            <>
              {/* ── Shared fields for Contract / Invoice / Packing List ── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Field label="Invoice #" value={invoiceNumber} onChange={setInvoiceNumber} placeholder="e.g. 1406" required />
                <Field label="Date" type="date" value={docDate} onChange={setDocDate} />
                {activeTab !== "packing_list" && (
                  <>
                    <Field label="Due Date" type="date" value={dueDate} onChange={setDueDate} />
                    <Field label="Currency" value={currency} onChange={setCurrency} />
                  </>
                )}
              </div>

              {activeTab !== "packing_list" && (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Payment Terms" value={terms} onChange={setTerms} multiline rows={2} />
                  {activeTab === "sales_contract" && (
                    <Field label="Incoterm" value={incoterm} onChange={setIncoterm} placeholder="CIF Shanghai" />
                  )}
                </div>
              )}

              {/* Bill To / Ship To */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-slate-700">Bill To</h3>
                  </div>
                  <div className="space-y-2">
                    <Field label="Company" value={billTo.company} onChange={(v) => setBillTo({ ...billTo, company: v })} placeholder="Company name" compact />
                    <Field label="Address 1" value={billTo.address1} onChange={(v) => setBillTo({ ...billTo, address1: v })} compact />
                    <Field label="Address 2" value={billTo.address2} onChange={(v) => setBillTo({ ...billTo, address2: v })} compact />
                    <Field label="Address 3" value={billTo.address3} onChange={(v) => setBillTo({ ...billTo, address3: v })} compact />
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Postal Code" value={billTo.postalCode} onChange={(v) => setBillTo({ ...billTo, postalCode: v })} compact />
                      <Field label="Country" value={billTo.country} onChange={(v) => setBillTo({ ...billTo, country: v })} compact />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-slate-700">Ship To</h3>
                    <button onClick={copyBillToShip} className="text-xs text-[#00b4c3] hover:text-[#009aaa] font-medium">
                      Copy from Bill To
                    </button>
                  </div>
                  <div className="space-y-2">
                    <Field label="Company" value={shipTo.company} onChange={(v) => setShipTo({ ...shipTo, company: v })} placeholder="Company name" compact />
                    <Field label="Address 1" value={shipTo.address1} onChange={(v) => setShipTo({ ...shipTo, address1: v })} compact />
                    <Field label="Address 2" value={shipTo.address2} onChange={(v) => setShipTo({ ...shipTo, address2: v })} compact />
                    <Field label="Address 3" value={shipTo.address3} onChange={(v) => setShipTo({ ...shipTo, address3: v })} compact />
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Postal Code" value={shipTo.postalCode} onChange={(v) => setShipTo({ ...shipTo, postalCode: v })} compact />
                      <Field label="Country" value={shipTo.country} onChange={(v) => setShipTo({ ...shipTo, country: v })} compact />
                    </div>
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-700">Line Items</h3>
                  <button onClick={addLineItem} className="text-xs text-[#00b4c3] hover:text-[#009aaa] font-medium">+ Add Item</button>
                </div>
                <div className="space-y-3">
                  {lineItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={item.activity}
                          onChange={(e) => updateLineItem(idx, "activity", e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                          placeholder="Product / Activity"
                        />
                      </div>
                      <div className="w-24">
                        <input
                          type="number"
                          value={item.qty || ""}
                          onChange={(e) => updateLineItem(idx, "qty", Number(e.target.value))}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                          placeholder="Qty"
                        />
                      </div>
                      {activeTab !== "packing_list" && (
                        <div className="w-24">
                          <input
                            type="number"
                            step="0.01"
                            value={item.rate || ""}
                            onChange={(e) => updateLineItem(idx, "rate", Number(e.target.value))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                            placeholder="Rate"
                          />
                        </div>
                      )}
                      <div className="w-16">
                        <input
                          type="text"
                          value={item.unit || ""}
                          onChange={(e) => updateLineItem(idx, "unit", e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                          placeholder="Unit"
                        />
                      </div>
                      {lineItems.length > 1 && (
                        <button onClick={() => removeLineItem(idx)} className="text-red-400 hover:text-red-600 text-lg mt-1.5">&times;</button>
                      )}
                    </div>
                  ))}
                </div>

                {activeTab !== "packing_list" && (
                  <div className="mt-3 text-right">
                    <span className="text-sm text-slate-500">Total: </span>
                    <span className="text-lg font-bold text-slate-900">
                      {currency} {totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>

              {/* Packing List extras */}
              {activeTab === "packing_list" && (
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Packaging Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Containers" value={containers} onChange={setContainers} placeholder="e.g. 20 Gaylords Each-" />
                    <Field label="Dimensions" value={dimensions} onChange={setDimensions} placeholder="121.92 cm x 101.6 cm x 114.3 cm" />
                    <Field label="Net Weight" value={netWeight} onChange={setNetWeight} placeholder="12,160.0 kgs" />
                    <Field label="Gross Weight" value={grossWeight} onChange={setGrossWeight} placeholder="14,968.548 kgs" />
                  </div>
                </div>
              )}

              {/* Sales Contract notes */}
              {activeTab === "sales_contract" && (
                <div className="border-t pt-4">
                  <Field label="Contract Notes" value={notes} onChange={setNotes} multiline rows={5} placeholder="Additional terms, tariff clauses, etc." />
                </div>
              )}
            </>
          )}
        </div>

        {/* Generate button */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50 rounded-b-2xl">
          <p className="text-xs text-slate-400">PDF will open in a new tab for download or printing</p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#00b4c3] text-white rounded-lg hover:bg-[#009aaa] font-semibold text-sm disabled:opacity-50 transition-colors"
          >
            {generating ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                {"\u{1F4C4}"} Generate PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Reusable Field component ── */
function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  multiline,
  rows = 3,
  compact,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
  rows?: number;
  compact?: boolean;
}) {
  const cls = `w-full px-3 py-${compact ? "1.5" : "2"} border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#00b4c3] focus:border-[#00b4c3]`;
  return (
    <div>
      {!compact && (
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {label} {required && <span className="text-red-400">*</span>}
        </label>
      )}
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cls}
          rows={rows}
          placeholder={placeholder || label}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cls}
          placeholder={placeholder || label}
        />
      )}
    </div>
  );
}
