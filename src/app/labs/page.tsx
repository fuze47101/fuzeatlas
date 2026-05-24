"use client";

import { useEffect, useState } from "react";
import AddCompanyModal from "@/components/AddCompanyModal";
import { useI18n } from "@/i18n";

interface LabService {
  id?: string;
  testType: string;
  testMethod: string;
  description: string;
  priceUSD: number | null;
  listPriceUSD: number | null;
  turnaroundDays: number | null;
  rushPriceUSD: number | null;
  rushDays: number | null;
  preferred: boolean;
  preferredNote: string;
  notes: string;
}

interface LabDoc {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes?: number;
  url?: string;
  createdAt: string;
}

interface Lab {
  id: string;
  name: string;
  city?: string;
  state?: string;
  country?: string;
  region?: string;
  website?: string;
  email?: string;
  phone?: string;
  accreditations?: string;
  customerNumber?: string;
  icpApproved: boolean;
  abApproved: boolean;
  fungalApproved: boolean;
  odorApproved: boolean;
  uvApproved: boolean;
  notes?: string;
  _count: { testRuns: number };
  services?: LabService[];
  documents?: LabDoc[];
}

interface CountryOption {
  name: string;
  count: number;
}

const CAPABILITY_BADGES = [
  { key: "icpApproved", label: "ICP", bg: "bg-blue-50", text: "text-blue-700" },
  { key: "abApproved", label: "Antibacterial", bg: "bg-purple-50", text: "text-purple-700" },
  { key: "fungalApproved", label: "Fungal", bg: "bg-orange-50", text: "text-orange-700" },
  { key: "odorApproved", label: "Odor", bg: "bg-rose-50", text: "text-rose-700" },
  { key: "uvApproved", label: "UV", bg: "bg-indigo-50", text: "text-indigo-700" },
] as const;

const TEST_TYPES = ["ICP", "ANTIBACTERIAL", "FUNGAL", "ODOR", "UV", "MICROFIBER", "OTHER"];

const COMMON_METHODS: Record<string, string[]> = {
  ICP: ["ICP-OES", "EPA 6010D", "ICP-MS"],
  ANTIBACTERIAL: ["AATCC 100", "ASTM E2149", "JIS L 1902", "ISO 20743", "AATCC 147"],
  FUNGAL: ["AATCC 30", "ASTM G21", "ISO 846"],
  ODOR: ["AATCC 100 (Odor)", "ISO 17299"],
  UV: ["AATCC 183", "AS/NZS 4399"],
  MICROFIBER: ["AATCC TM212"],
  OTHER: [],
};

const EMPTY_FORM = {
  name: "",
  address: "",
  city: "",
  state: "",
  country: "",
  region: "",
  website: "",
  email: "",
  phone: "",
  accreditations: "",
  notes: "",
  customerNumber: "",
  icpApproved: false,
  abApproved: false,
  fungalApproved: false,
  odorApproved: false,
  uvApproved: false,
};

const EMPTY_SERVICE: LabService = {
  testType: "ANTIBACTERIAL",
  testMethod: "",
  description: "",
  priceUSD: null,
  listPriceUSD: null,
  turnaroundDays: null,
  rushPriceUSD: null,
  rushDays: null,
  preferred: false,
  preferredNote: "",
  notes: "",
};

const PREFERRED_NOTES = ["Best Price", "Best Accuracy", "Fastest Turnaround", "FUZE Recommended"];

export default function LabDirectoryPage() {
  const { t } = useI18n();
  const T = t.labsDirectory;
  const [labs, setLabs] = useState<Lab[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCountry, setFilterCountry] = useState("");
  const [filterCapability, setFilterCapability] = useState("");

  // Add / Edit state
  const [showAdd, setShowAdd] = useState(false);
  const [addCompanyOpen, setAddCompanyOpen] = useState(false);
  const [editingLabId, setEditingLabId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [services, setServices] = useState<LabService[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expandedLab, setExpandedLab] = useState<string | null>(null);

  // Document upload
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const loadLabs = (country?: string, capability?: string, searchQuery?: string) => {
    const params = new URLSearchParams();
    if (country) params.set("country", country);
    if (capability) params.set("capability", capability);
    if (searchQuery) params.set("search", searchQuery);
    fetch(`/api/labs?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setLabs(d.labs);
          setCountries(d.countries || []);
        }
      })
      .finally(() => setLoading(false));
  };

  const loadLabDetail = async (labId: string) => {
    const res = await fetch(`/api/labs/${labId}`);
    const d = await res.json();
    if (d.ok) {
      // Update lab in list with full details
      setLabs((prev) => prev.map((l) => (l.id === labId ? { ...l, ...d.lab } : l)));
      return d.lab;
    }
    return null;
  };

  useEffect(() => {
    loadLabs();
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      loadLabs(filterCountry, filterCapability, search);
    }, 300);
    return () => clearTimeout(debounce);
  }, [filterCountry, filterCapability, search]);

  // Start editing a lab
  const startEdit = async (lab: Lab) => {
    const detail = await loadLabDetail(lab.id);
    setEditingLabId(lab.id);
    setForm({
      name: lab.name || "",
      address: "",
      city: lab.city || "",
      state: lab.state || "",
      country: lab.country || "",
      region: lab.region || "",
      website: lab.website || "",
      email: lab.email || "",
      phone: lab.phone || "",
      accreditations: lab.accreditations || "",
      notes: lab.notes || "",
      customerNumber: (detail || (lab as any)).customerNumber || "",
      icpApproved: lab.icpApproved,
      abApproved: lab.abApproved,
      fungalApproved: lab.fungalApproved,
      odorApproved: lab.odorApproved,
      uvApproved: lab.uvApproved,
    });
    setServices(detail?.services || []);
    setExpandedLab(lab.id);
  };

  const cancelEdit = () => {
    setEditingLabId(null);
    setForm({ ...EMPTY_FORM });
    setServices([]);
  };

  // Add new lab
  const handleAdd = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/labs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, services }),
      });
      const d = await res.json();
      if (d.ok) {
        // If there are services, save them via PUT
        if (services.length > 0) {
          await fetch(`/api/labs/${d.lab.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ services }),
          });
        }
        setShowAdd(false);
        setForm({ ...EMPTY_FORM });
        setServices([]);
        setSuccess(T.labAdded);
        setTimeout(() => setSuccess(""), 3000);
        loadLabs(filterCountry, filterCapability, search);
      } else {
        setError(d.error || T.failedAdd);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // Save edits
  const handleSave = async () => {
    if (!editingLabId || !form.name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/labs/${editingLabId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, services }),
      });
      const d = await res.json();
      if (d.ok) {
        setEditingLabId(null);
        setForm({ ...EMPTY_FORM });
        setServices([]);
        setSuccess(T.labUpdated);
        setTimeout(() => setSuccess(""), 3000);
        loadLabs(filterCountry, filterCapability, search);
      } else {
        setError(d.error || T.failedUpdate);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // Service management
  const addService = () => setServices([...services, { ...EMPTY_SERVICE }]);
  const removeService = (idx: number) => setServices(services.filter((_, i) => i !== idx));
  const updateService = (idx: number, patch: Partial<LabService>) => {
    setServices(services.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  // Document upload
  const handleDocUpload = async (labId: string, file: File) => {
    setUploadingDoc(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.readAsDataURL(file);
      });
      const res = await fetch(`/api/labs/${labId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          sizeBytes: file.size,
          base64Data: base64,
        }),
      });
      const d = await res.json();
      if (d.ok) {
        await loadLabDetail(labId);
        setSuccess(T.uploadedToast.replace("{name}", file.name));
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDocDelete = async (labId: string, docId: string, filename: string) => {
    if (!confirm(T.deletePrompt.replace("{name}", filename))) return;
    try {
      const res = await fetch(`/api/labs/${labId}/documents?docId=${docId}`, { method: "DELETE" });
      const d = await res.json();
      if (d.ok) {
        await loadLabDetail(labId);
        setSuccess(T.deletedToast.replace("{name}", filename));
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(d.error || T.deleteFailed);
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const capCount = (lab: Lab) =>
    [lab.icpApproved, lab.abApproved, lab.fungalApproved, lab.odorApproved, lab.uvApproved].filter(
      Boolean,
    ).length;

  const isEditing = (labId: string) => editingLabId === labId;

  // Shared form renderer (used for both Add and Edit)
  const renderForm = (isAdd: boolean) => (
    <div
      className={`${isAdd ? "mb-6 bg-white border border-slate-200 rounded-xl p-6 shadow-sm" : ""}`}
    >
      {isAdd && <h3 className="font-bold text-slate-900 mb-4">{T.addNewLab}</h3>}

      {/* Core fields */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            {T.labName} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={T.labNamePlaceholder}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">{T.city}</label>
          <input
            type="text"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={T.cityPlaceholder}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">{T.country}</label>
          <input
            type="text"
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={T.countryPlaceholder}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">{T.region}</label>
          <select
            value={form.region}
            onChange={(e) => setForm({ ...form, region: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{T.selectRegion}</option>
            <option value="Asia Pacific">{T.regionAP}</option>
            <option value="North America">{T.regionNA}</option>
            <option value="Europe">{T.regionEU}</option>
            <option value="South America">{T.regionSA}</option>
            <option value="Middle East">{T.regionME}</option>
            <option value="Africa">{T.regionAF}</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">{T.website}</label>
          <input
            type="text"
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://..."
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">{T.email}</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={T.emailPlaceholder}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">{T.phone}</label>
          <input
            type="text"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            {T.customerNumber}
          </label>
          <input
            type="text"
            value={form.customerNumber}
            onChange={(e) => setForm({ ...form, customerNumber: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={T.customerNumberPlaceholder}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">{T.accreditations}</label>
          <input
            type="text"
            value={form.accreditations}
            onChange={(e) => setForm({ ...form, accreditations: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={T.accreditationsPlaceholder}
          />
        </div>
      </div>

      {/* Capability checkboxes */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-slate-600 mb-2">
          {T.approvedTestTypes}
        </label>
        <div className="flex flex-wrap gap-4">
          {[
            { key: "icpApproved", label: "ICP" },
            { key: "abApproved", label: "Antibacterial" },
            { key: "fungalApproved", label: "Fungal" },
            { key: "odorApproved", label: "Odor" },
            { key: "uvApproved", label: "UV" },
          ].map(({ key, label }) => (
            <label
              key={key}
              className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={(form as any)[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-xs font-semibold text-slate-600 mb-1">{T.notes}</label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={2}
          placeholder={T.notesPlaceholder}
        />
      </div>

      {/* ═══ TEST SERVICES & PRICING ═══ */}
      <div className="border-t border-slate-200 pt-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-bold text-slate-800 text-sm">{T.testServicesPricing}</h4>
          <button
            onClick={addService}
            className="px-3 py-1.5 text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
          >
            {T.addService}
          </button>
        </div>

        {services.length === 0 ? (
          <p className="text-sm text-slate-400 italic">
            {T.noServices}
          </p>
        ) : (
          <div className="space-y-3">
            {services.map((svc, idx) => (
              <div key={idx} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                        {T.testType}
                      </label>
                      <select
                        value={svc.testType}
                        onChange={(e) => updateService(idx, { testType: e.target.value })}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm"
                      >
                        {TEST_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                        {T.testMethod}
                      </label>
                      <select
                        value={svc.testMethod}
                        onChange={(e) => updateService(idx, { testMethod: e.target.value })}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm"
                      >
                        <option value="">{T.selectMethod}</option>
                        {(COMMON_METHODS[svc.testType] || []).map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                        <option value="__custom">{T.custom}</option>
                      </select>
                      {svc.testMethod === "__custom" && (
                        <input
                          type="text"
                          placeholder={T.enterMethod}
                          className="w-full mt-1 px-2 py-1.5 border border-slate-300 rounded-lg text-sm"
                          onChange={(e) => updateService(idx, { testMethod: e.target.value })}
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                        {T.description}
                      </label>
                      <input
                        type="text"
                        value={svc.description}
                        onChange={(e) => updateService(idx, { description: e.target.value })}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm"
                        placeholder={T.descriptionPlaceholder}
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => removeService(idx)}
                    className="ml-3 text-red-400 hover:text-red-600 text-lg font-bold"
                  >
                    ×
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                      {T.ourPrice}
                    </label>
                    <input
                      type="number"
                      value={svc.priceUSD ?? ""}
                      step="0.01"
                      onChange={(e) =>
                        updateService(idx, {
                          priceUSD: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                      {T.listPrice}
                    </label>
                    <input
                      type="number"
                      value={svc.listPriceUSD ?? ""}
                      step="0.01"
                      onChange={(e) =>
                        updateService(idx, {
                          listPriceUSD: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                      {T.turnaroundDays}
                    </label>
                    <input
                      type="number"
                      value={svc.turnaroundDays ?? ""}
                      onChange={(e) =>
                        updateService(idx, {
                          turnaroundDays: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm"
                      placeholder="10"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                      {T.rushPrice}
                    </label>
                    <input
                      type="number"
                      value={svc.rushPriceUSD ?? ""}
                      step="0.01"
                      onChange={(e) =>
                        updateService(idx, {
                          rushPriceUSD: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                      {T.rushDays}
                    </label>
                    <input
                      type="number"
                      value={svc.rushDays ?? ""}
                      onChange={(e) =>
                        updateService(idx, {
                          rushDays: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm"
                      placeholder="3"
                    />
                  </div>
                </div>

                {svc.priceUSD && svc.listPriceUSD && svc.listPriceUSD > svc.priceUSD && (
                  <div className="mt-2 text-xs text-emerald-600 font-medium">
                    {T.discountOff.replace("{pct}", ((1 - svc.priceUSD / svc.listPriceUSD) * 100).toFixed(0))}
                  </div>
                )}

                {/* Preferred toggle + note */}
                <div className="mt-3 flex items-center gap-4 p-2 rounded-lg bg-white border border-slate-200">
                  <label className="flex items-center gap-2 text-sm cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={svc.preferred}
                      onChange={(e) => updateService(idx, { preferred: e.target.checked })}
                      className="w-4 h-4 text-[#00b4c3] rounded border-slate-300 focus:ring-[#00b4c3]"
                    />
                    <span
                      className={`font-semibold text-xs ${svc.preferred ? "text-[#00b4c3]" : "text-slate-500"}`}
                    >
                      {T.fuzePreferred}
                    </span>
                  </label>
                  {svc.preferred && (
                    <select
                      value={svc.preferredNote || ""}
                      onChange={(e) => updateService(idx, { preferredNote: e.target.value })}
                      className="flex-1 px-2 py-1 border border-[#00b4c3]/30 rounded-lg text-xs text-[#00b4c3] bg-[#00b4c3]/5"
                    >
                      <option value="">{T.selectReason}</option>
                      {PREFERRED_NOTES.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="mt-2">
                  <input
                    type="text"
                    value={svc.notes}
                    onChange={(e) => updateService(idx, { notes: e.target.value })}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-500"
                    placeholder={T.serviceNotesPlaceholder}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-4">
        <button
          onClick={isAdd ? handleAdd : handleSave}
          disabled={saving || !form.name.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? T.saving : isAdd ? T.addLab : T.saveChanges}
        </button>
        <button
          onClick={
            isAdd
              ? () => {
                  setShowAdd(false);
                  setServices([]);
                }
              : cancelEdit
          }
          className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
        >
          {T.cancel}
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="p-4 sm:p-8 flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900">{T.pageTitle}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {T.subtitle.replace("{count}", String(labs.length)).replace("{countries}", String(countries.length))}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAddCompanyOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 whitespace-nowrap"
            title={T.addCompanyTitle}
          >
            {T.addCompany}
          </button>
          <button
            onClick={() => {
              setShowAdd(!showAdd);
              setEditingLabId(null);
              setServices([]);
              setForm({ ...EMPTY_FORM });
            }}
            className="px-3 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 whitespace-nowrap"
          >
            {T.addLabDetailed}
          </button>
        </div>
      </div>

      <AddCompanyModal
        open={addCompanyOpen}
        onClose={() => setAddCompanyOpen(false)}
        initialType="LAB"
      />

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          {success}
        </div>
      )}

      {/* Add Lab Form */}
      {showAdd && renderForm(true)}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={T.searchPlaceholder}
          className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={filterCountry}
          onChange={(e) => setFilterCountry(e.target.value)}
          className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{T.allCountries}</option>
          {countries.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name} ({c.count})
            </option>
          ))}
        </select>
        <select
          value={filterCapability}
          onChange={(e) => setFilterCapability(e.target.value)}
          className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{T.allTestTypes}</option>
          <option value="icp">{T.icpApproved}</option>
          <option value="ab">{T.abApproved}</option>
          <option value="fungal">{T.fungalApproved}</option>
          <option value="odor">{T.odorApproved}</option>
          <option value="uv">{T.uvApproved}</option>
        </select>
      </div>

      {/* Lab Cards */}
      {labs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-slate-400">
            {search || filterCountry || filterCapability
              ? T.noLabsFilter
              : T.noLabsYet}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {labs.map((lab) => {
            const isExpanded = expandedLab === lab.id;
            const editing = isEditing(lab.id);
            const hasPreferred = lab.services?.some((s: any) => s.preferred) || false;
            return (
              <div
                key={lab.id}
                className={`bg-white border rounded-xl shadow-sm overflow-hidden ${hasPreferred ? "border-[#00b4c3]/40" : "border-slate-200"}`}
              >
                {/* Lab Header Row */}
                <div
                  className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => {
                    if (!editing) {
                      if (!isExpanded) loadLabDetail(lab.id);
                      setExpandedLab(isExpanded ? null : lab.id);
                    }
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-bold text-slate-900 truncate">{lab.name}</h3>
                      {hasPreferred && (
                        <span className="flex-shrink-0 px-2 py-0.5 bg-[#00b4c3]/10 text-[#00b4c3] text-xs rounded-full font-bold">
                          {T.fuzePreferred}
                        </span>
                      )}
                      {lab._count.testRuns > 0 && (
                        <span className="flex-shrink-0 px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full font-medium">
                          {T.testsCount.replace("{n}", String(lab._count.testRuns))}
                        </span>
                      )}
                      {(lab as any).customerNumber && (
                        <span className="flex-shrink-0 px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full font-medium">
                          {T.acctLabel.replace("{num}", String((lab as any).customerNumber))}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      {lab.city && <span>{lab.city}</span>}
                      {lab.city && lab.country && <span>·</span>}
                      {lab.country && <span className="font-medium">{lab.country}</span>}
                      {lab.region && <span className="text-slate-400">({lab.region})</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 ml-4">
                    {CAPABILITY_BADGES.map(({ key, label, bg, text }) =>
                      (lab as any)[key] ? (
                        <span
                          key={key}
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}
                        >
                          {label}
                        </span>
                      ) : null,
                    )}
                    <svg
                      className={`w-5 h-5 text-slate-400 transition-transform ml-2 ${isExpanded ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && !editing && (
                  <div className="border-t border-slate-200 px-5 py-4">
                    {/* Edit button */}
                    <div className="flex justify-end mb-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(lab);
                        }}
                        className="px-3 py-1.5 text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
                      >
                        {T.editLab}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                      {/* Contact Info */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                          {T.contact}
                        </h4>
                        {lab.website && (
                          <div>
                            <p className="text-xs text-slate-500">{T.website}</p>
                            <a
                              href={
                                lab.website.startsWith("http")
                                  ? lab.website
                                  : `https://${lab.website}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:underline"
                            >
                              {lab.website}
                            </a>
                          </div>
                        )}
                        {lab.email && (
                          <div>
                            <p className="text-xs text-slate-500">{T.email}</p>
                            <a
                              href={`mailto:${lab.email}`}
                              className="text-sm text-blue-600 hover:underline"
                            >
                              {lab.email}
                            </a>
                          </div>
                        )}
                        {lab.phone && (
                          <div>
                            <p className="text-xs text-slate-500">{T.phone}</p>
                            <p className="text-sm text-slate-900">{lab.phone}</p>
                          </div>
                        )}
                        {(lab as any).customerNumber && (
                          <div>
                            <p className="text-xs text-slate-500">{T.accountNumber}</p>
                            <p className="text-sm font-mono text-slate-900">
                              {(lab as any).customerNumber}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Accreditations & Capabilities */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                          {T.accreditations}
                        </h4>
                        {lab.accreditations ? (
                          <div className="flex flex-wrap gap-1.5">
                            {lab.accreditations.split(",").map((acc, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded-full font-medium"
                              >
                                {acc.trim()}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400">{T.noneListed}</p>
                        )}
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mt-4">
                          {T.approvedTests}
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {CAPABILITY_BADGES.map(({ key, label, bg, text }) => (
                            <span
                              key={key}
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${(lab as any)[key] ? `${bg} ${text}` : "bg-slate-100 text-slate-400 line-through"}`}
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                          {T.stats}
                        </h4>
                        <div>
                          <p className="text-xs text-slate-500">{T.testsCompleted}</p>
                          <p className="text-lg font-bold text-slate-900">{lab._count.testRuns}</p>
                        </div>
                        {capCount(lab) > 0 && (
                          <div>
                            <p className="text-xs text-slate-500">{T.capabilities}</p>
                            <p className="text-lg font-bold text-slate-900">{T.capabilitiesOf.replace("{n}", String(capCount(lab)))}</p>
                          </div>
                        )}
                        {lab.notes && (
                          <div>
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mt-4">
                              {T.notes}
                            </h4>
                            <p className="text-sm text-slate-600">{lab.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ═══ SERVICES & PRICING TABLE ═══ */}
                    {lab.services && lab.services.length > 0 && (
                      <div className="mt-6 border-t border-slate-200 pt-4">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
                          {T.testServicesPricing}
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 text-left">
                                <th className="py-2 pr-3 font-semibold text-slate-500">
                                  {T.testType}
                                </th>
                                <th className="py-2 pr-3 font-semibold text-slate-500">{T.method}</th>
                                <th className="py-2 pr-3 font-semibold text-slate-500">
                                  {T.description}
                                </th>
                                <th className="py-2 pr-3 font-semibold text-slate-500 text-right">
                                  {T.ourPrice}
                                </th>
                                <th className="py-2 pr-3 font-semibold text-slate-500 text-right">
                                  {T.listPrice}
                                </th>
                                <th className="py-2 pr-3 font-semibold text-slate-500 text-right">
                                  {T.discount}
                                </th>
                                <th className="py-2 pr-3 font-semibold text-slate-500 text-center">
                                  {T.days}
                                </th>
                                <th className="py-2 pr-3 font-semibold text-slate-500 text-right">
                                  {T.rush}
                                </th>
                                <th className="py-2 font-semibold text-slate-500">{T.notes}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {lab.services.map((svc: any) => {
                                const discount =
                                  svc.priceUSD &&
                                  svc.listPriceUSD &&
                                  svc.listPriceUSD > svc.priceUSD
                                    ? ((1 - svc.priceUSD / svc.listPriceUSD) * 100).toFixed(0) + "%"
                                    : "—";
                                return (
                                  <tr
                                    key={svc.id}
                                    className={`border-b ${svc.preferred ? "border-[#00b4c3]/20 bg-[#00b4c3]/[0.03]" : "border-slate-100"}`}
                                  >
                                    <td className="py-2 pr-3">
                                      <div className="flex items-center gap-1.5">
                                        <span
                                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                            svc.testType === "ICP"
                                              ? "bg-blue-50 text-blue-700"
                                              : svc.testType === "ANTIBACTERIAL"
                                                ? "bg-purple-50 text-purple-700"
                                                : svc.testType === "FUNGAL"
                                                  ? "bg-orange-50 text-orange-700"
                                                  : svc.testType === "ODOR"
                                                    ? "bg-rose-50 text-rose-700"
                                                    : svc.testType === "UV"
                                                      ? "bg-indigo-50 text-indigo-700"
                                                      : "bg-slate-50 text-slate-700"
                                          }`}
                                        >
                                          {svc.testType}
                                        </span>
                                        {svc.preferred && (
                                          <span
                                            className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#00b4c3]/10 text-[#00b4c3]"
                                            title={svc.preferredNote || T.fuzePreferred}
                                          >
                                            ★ {svc.preferredNote || T.preferredLabel}
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-2 pr-3 font-mono text-slate-600">
                                      {svc.testMethod || "—"}
                                    </td>
                                    <td className="py-2 pr-3 text-slate-600">
                                      {svc.description || "—"}
                                    </td>
                                    <td className="py-2 pr-3 text-right font-bold text-emerald-600">
                                      {svc.priceUSD ? `$${svc.priceUSD.toFixed(2)}` : "—"}
                                    </td>
                                    <td className="py-2 pr-3 text-right text-slate-500">
                                      {svc.listPriceUSD ? `$${svc.listPriceUSD.toFixed(2)}` : "—"}
                                    </td>
                                    <td className="py-2 pr-3 text-right text-emerald-600 font-semibold">
                                      {discount}
                                    </td>
                                    <td className="py-2 pr-3 text-center text-slate-600">
                                      {svc.turnaroundDays || "—"}
                                    </td>
                                    <td className="py-2 pr-3 text-right text-slate-600">
                                      {svc.rushPriceUSD ? `$${svc.rushPriceUSD.toFixed(2)}` : "—"}
                                      {svc.rushDays ? ` (${svc.rushDays}d)` : ""}
                                    </td>
                                    <td className="py-2 text-slate-400">{svc.notes || ""}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* ═══ SUBMISSION FORMS / DOCUMENTS ═══ */}
                    <div className="mt-6 border-t border-slate-200 pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                          {T.submissionForms}
                        </h4>
                        <label className="px-3 py-1.5 text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 cursor-pointer">
                          {uploadingDoc ? T.uploading : T.upload}
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx,.xls,.xlsx"
                            className="hidden"
                            disabled={uploadingDoc}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleDocUpload(lab.id, file);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      </div>

                      {lab.documents && lab.documents.length > 0 ? (
                        <div className="space-y-2">
                          {lab.documents.map((doc: any) => (
                            <div
                              key={doc.id}
                              className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                                  <svg
                                    className="w-4 h-4 text-red-600"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                    />
                                  </svg>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-slate-700">
                                    {doc.filename}
                                  </p>
                                  <p className="text-xs text-slate-400">
                                    {doc.sizeBytes
                                      ? `${(doc.sizeBytes / 1024).toFixed(0)} KB · `
                                      : ""}
                                    Uploaded {new Date(doc.createdAt).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <a
                                  href={doc.url || `/api/documents/${doc.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                >
                                  {T.download}
                                </a>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDocDelete(lab.id, doc.id, doc.filename);
                                  }}
                                  className="text-xs text-red-400 hover:text-red-600 font-medium"
                                >
                                  {T.deleteBtn}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400 italic">
                          {T.noForms}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Edit Mode */}
                {isExpanded && editing && (
                  <div className="border-t border-slate-200 px-5 py-4 bg-blue-50/30">
                    <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                      {T.editing.replace("{name}", lab.name)}
                    </h3>
                    {renderForm(false)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
