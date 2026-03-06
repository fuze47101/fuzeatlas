"use client";

import { useEffect, useState } from "react";

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

interface CountryOption { name: string; count: number; }

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
  name: "", address: "", city: "", state: "", country: "", region: "",
  website: "", email: "", phone: "", accreditations: "", notes: "", customerNumber: "",
  icpApproved: false, abApproved: false, fungalApproved: false,
  odorApproved: false, uvApproved: false,
};

const EMPTY_SERVICE: LabService = {
  testType: "ANTIBACTERIAL", testMethod: "", description: "",
  priceUSD: null, listPriceUSD: null, turnaroundDays: null,
  rushPriceUSD: null, rushDays: null, notes: "",
};

export default function LabDirectoryPage() {
  const [labs, setLabs] = useState<Lab[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCountry, setFilterCountry] = useState("");
  const [filterCapability, setFilterCapability] = useState("");

  // Add / Edit state
  const [showAdd, setShowAdd] = useState(false);
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
      setLabs(prev => prev.map(l => l.id === labId ? { ...l, ...d.lab } : l));
      return d.lab;
    }
    return null;
  };

  useEffect(() => { loadLabs(); }, []);

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
      customerNumber: (detail || lab as any).customerNumber || "",
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
        setSuccess("Lab added successfully");
        setTimeout(() => setSuccess(""), 3000);
        loadLabs(filterCountry, filterCapability, search);
      } else {
        setError(d.error || "Failed to add lab");
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
        setSuccess("Lab updated successfully");
        setTimeout(() => setSuccess(""), 3000);
        loadLabs(filterCountry, filterCapability, search);
      } else {
        setError(d.error || "Failed to update lab");
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
    setServices(services.map((s, i) => i === idx ? { ...s, ...patch } : s));
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
        setSuccess(`Uploaded ${file.name}`);
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDocDelete = async (labId: string, docId: string, filename: string) => {
    if (!confirm(`Delete "${filename}"?`)) return;
    try {
      const res = await fetch(`/api/labs/${labId}/documents?docId=${docId}`, { method: "DELETE" });
      const d = await res.json();
      if (d.ok) {
        await loadLabDetail(labId);
        setSuccess(`Deleted ${filename}`);
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(d.error || "Delete failed");
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const capCount = (lab: Lab) =>
    [lab.icpApproved, lab.abApproved, lab.fungalApproved, lab.odorApproved, lab.uvApproved]
      .filter(Boolean).length;

  const isEditing = (labId: string) => editingLabId === labId;

  // Shared form renderer (used for both Add and Edit)
  const renderForm = (isAdd: boolean) => (
    <div className={`${isAdd ? "mb-6 bg-white border border-slate-200 rounded-xl p-6 shadow-sm" : ""}`}>
      {isAdd && <h3 className="font-bold text-slate-900 mb-4">Add New Lab</h3>}

      {/* Core fields */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Lab Name <span className="text-red-500">*</span></label>
          <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. ITS Taiwan (Intertek)" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">City</label>
          <input type="text" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Taipei" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Country</label>
          <input type="text" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Taiwan" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Region</label>
          <select value={form.region} onChange={e => setForm({ ...form, region: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Select region...</option>
            <option value="Asia Pacific">Asia Pacific</option>
            <option value="North America">North America</option>
            <option value="Europe">Europe</option>
            <option value="South America">South America</option>
            <option value="Middle East">Middle East</option>
            <option value="Africa">Africa</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Website</label>
          <input type="text" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="https://..." />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
          <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="lab@example.com" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Phone</label>
          <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Customer / Account #</label>
          <input type="text" value={form.customerNumber} onChange={e => setForm({ ...form, customerNumber: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Your account # at this lab" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Accreditations</label>
          <input type="text" value={form.accreditations} onChange={e => setForm({ ...form, accreditations: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. ISO 17025, TAF, CNAS" />
        </div>
      </div>

      {/* Capability checkboxes */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-slate-600 mb-2">Approved Test Types</label>
        <div className="flex flex-wrap gap-4">
          {[
            { key: "icpApproved", label: "ICP" },
            { key: "abApproved", label: "Antibacterial" },
            { key: "fungalApproved", label: "Fungal" },
            { key: "odorApproved", label: "Odor" },
            { key: "uvApproved", label: "UV" },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={(form as any)[key]} onChange={e => setForm({ ...form, [key]: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
        <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} placeholder="Additional notes..." />
      </div>

      {/* ═══ TEST SERVICES & PRICING ═══ */}
      <div className="border-t border-slate-200 pt-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-bold text-slate-800 text-sm">Test Services & Pricing</h4>
          <button onClick={addService} className="px-3 py-1.5 text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50">
            + Add Service
          </button>
        </div>

        {services.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No services added yet. Add test types and their pricing.</p>
        ) : (
          <div className="space-y-3">
            {services.map((svc, idx) => (
              <div key={idx} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Test Type</label>
                      <select value={svc.testType} onChange={e => updateService(idx, { testType: e.target.value })}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm">
                        {TEST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Test Method</label>
                      <select
                        value={svc.testMethod}
                        onChange={e => updateService(idx, { testMethod: e.target.value })}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm"
                      >
                        <option value="">Select method...</option>
                        {(COMMON_METHODS[svc.testType] || []).map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                        <option value="__custom">Custom...</option>
                      </select>
                      {svc.testMethod === "__custom" && (
                        <input type="text" placeholder="Enter method..." className="w-full mt-1 px-2 py-1.5 border border-slate-300 rounded-lg text-sm"
                          onChange={e => updateService(idx, { testMethod: e.target.value })} />
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Description</label>
                      <input type="text" value={svc.description} onChange={e => updateService(idx, { description: e.target.value })}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm"
                        placeholder="e.g. S. aureus + K. pneumoniae" />
                    </div>
                  </div>
                  <button onClick={() => removeService(idx)} className="ml-3 text-red-400 hover:text-red-600 text-lg font-bold">×</button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">Our Price ($)</label>
                    <input type="number" value={svc.priceUSD ?? ""} step="0.01"
                      onChange={e => updateService(idx, { priceUSD: e.target.value ? Number(e.target.value) : null })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">List Price ($)</label>
                    <input type="number" value={svc.listPriceUSD ?? ""} step="0.01"
                      onChange={e => updateService(idx, { listPriceUSD: e.target.value ? Number(e.target.value) : null })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">Turnaround (days)</label>
                    <input type="number" value={svc.turnaroundDays ?? ""}
                      onChange={e => updateService(idx, { turnaroundDays: e.target.value ? Number(e.target.value) : null })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm" placeholder="10" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">Rush Price ($)</label>
                    <input type="number" value={svc.rushPriceUSD ?? ""} step="0.01"
                      onChange={e => updateService(idx, { rushPriceUSD: e.target.value ? Number(e.target.value) : null })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">Rush (days)</label>
                    <input type="number" value={svc.rushDays ?? ""}
                      onChange={e => updateService(idx, { rushDays: e.target.value ? Number(e.target.value) : null })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm" placeholder="3" />
                  </div>
                </div>

                {svc.priceUSD && svc.listPriceUSD && svc.listPriceUSD > svc.priceUSD && (
                  <div className="mt-2 text-xs text-emerald-600 font-medium">
                    Discount: {((1 - svc.priceUSD / svc.listPriceUSD) * 100).toFixed(0)}% off list price
                  </div>
                )}

                <div className="mt-2">
                  <input type="text" value={svc.notes} onChange={e => updateService(idx, { notes: e.target.value })}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-500"
                    placeholder="Notes (min qty, special conditions...)" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-4">
        <button onClick={isAdd ? handleAdd : handleSave} disabled={saving || !form.name.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
          {saving ? "Saving..." : isAdd ? "Add Lab" : "Save Changes"}
        </button>
        <button onClick={isAdd ? () => { setShowAdd(false); setServices([]); } : cancelEdit}
          className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">
          Cancel
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
          <h1 className="text-2xl font-black text-slate-900">Lab Directory</h1>
          <p className="text-sm text-slate-500 mt-1">
            {labs.length} approved testing labs across {countries.length} countries
          </p>
        </div>
        <button
          onClick={() => { setShowAdd(!showAdd); setEditingLabId(null); setServices([]); setForm({ ...EMPTY_FORM }); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
        >
          + Add Lab
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{success}</div>}

      {/* Add Lab Form */}
      {showAdd && renderForm(true)}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search labs by name, city, or country..."
          className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <select value={filterCountry} onChange={e => setFilterCountry(e.target.value)}
          className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Countries</option>
          {countries.map(c => <option key={c.name} value={c.name}>{c.name} ({c.count})</option>)}
        </select>
        <select value={filterCapability} onChange={e => setFilterCapability(e.target.value)}
          className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Test Types</option>
          <option value="icp">ICP Approved</option>
          <option value="ab">Antibacterial Approved</option>
          <option value="fungal">Fungal Approved</option>
          <option value="odor">Odor Approved</option>
          <option value="uv">UV Approved</option>
        </select>
      </div>

      {/* Lab Cards */}
      {labs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-slate-400">{search || filterCountry || filterCapability ? "No labs match your filters" : "No labs in the directory yet"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {labs.map(lab => {
            const isExpanded = expandedLab === lab.id;
            const editing = isEditing(lab.id);
            return (
              <div key={lab.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
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
                      {lab._count.testRuns > 0 && (
                        <span className="flex-shrink-0 px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full font-medium">
                          {lab._count.testRuns} tests
                        </span>
                      )}
                      {(lab as any).customerNumber && (
                        <span className="flex-shrink-0 px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full font-medium">
                          Acct: {(lab as any).customerNumber}
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
                        <span key={key} className={`px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>{label}</span>
                      ) : null
                    )}
                    <svg className={`w-5 h-5 text-slate-400 transition-transform ml-2 ${isExpanded ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && !editing && (
                  <div className="border-t border-slate-200 px-5 py-4">
                    {/* Edit button */}
                    <div className="flex justify-end mb-3">
                      <button onClick={(e) => { e.stopPropagation(); startEdit(lab); }}
                        className="px-3 py-1.5 text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50">
                        Edit Lab
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                      {/* Contact Info */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Contact</h4>
                        {lab.website && (
                          <div>
                            <p className="text-xs text-slate-500">Website</p>
                            <a href={lab.website.startsWith("http") ? lab.website : `https://${lab.website}`}
                              target="_blank" rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:underline">{lab.website}</a>
                          </div>
                        )}
                        {lab.email && (
                          <div>
                            <p className="text-xs text-slate-500">Email</p>
                            <a href={`mailto:${lab.email}`} className="text-sm text-blue-600 hover:underline">{lab.email}</a>
                          </div>
                        )}
                        {lab.phone && (
                          <div>
                            <p className="text-xs text-slate-500">Phone</p>
                            <p className="text-sm text-slate-900">{lab.phone}</p>
                          </div>
                        )}
                        {(lab as any).customerNumber && (
                          <div>
                            <p className="text-xs text-slate-500">Account Number</p>
                            <p className="text-sm font-mono text-slate-900">{(lab as any).customerNumber}</p>
                          </div>
                        )}
                      </div>

                      {/* Accreditations & Capabilities */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Accreditations</h4>
                        {lab.accreditations ? (
                          <div className="flex flex-wrap gap-1.5">
                            {lab.accreditations.split(",").map((acc, i) => (
                              <span key={i} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded-full font-medium">{acc.trim()}</span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400">None listed</p>
                        )}
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mt-4">Approved Tests</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {CAPABILITY_BADGES.map(({ key, label, bg, text }) => (
                            <span key={key} className={`px-2 py-0.5 rounded-full text-xs font-medium ${(lab as any)[key] ? `${bg} ${text}` : "bg-slate-100 text-slate-400 line-through"}`}>{label}</span>
                          ))}
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Stats</h4>
                        <div>
                          <p className="text-xs text-slate-500">Tests Completed</p>
                          <p className="text-lg font-bold text-slate-900">{lab._count.testRuns}</p>
                        </div>
                        {capCount(lab) > 0 && (
                          <div>
                            <p className="text-xs text-slate-500">Capabilities</p>
                            <p className="text-lg font-bold text-slate-900">{capCount(lab)} of 5</p>
                          </div>
                        )}
                        {lab.notes && (
                          <div>
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mt-4">Notes</h4>
                            <p className="text-sm text-slate-600">{lab.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ═══ SERVICES & PRICING TABLE ═══ */}
                    {lab.services && lab.services.length > 0 && (
                      <div className="mt-6 border-t border-slate-200 pt-4">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Test Services & Pricing</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 text-left">
                                <th className="py-2 pr-3 font-semibold text-slate-500">Test Type</th>
                                <th className="py-2 pr-3 font-semibold text-slate-500">Method</th>
                                <th className="py-2 pr-3 font-semibold text-slate-500">Description</th>
                                <th className="py-2 pr-3 font-semibold text-slate-500 text-right">Our Price</th>
                                <th className="py-2 pr-3 font-semibold text-slate-500 text-right">List Price</th>
                                <th className="py-2 pr-3 font-semibold text-slate-500 text-right">Discount</th>
                                <th className="py-2 pr-3 font-semibold text-slate-500 text-center">Days</th>
                                <th className="py-2 pr-3 font-semibold text-slate-500 text-right">Rush</th>
                                <th className="py-2 font-semibold text-slate-500">Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {lab.services.map((svc: any) => {
                                const discount = svc.priceUSD && svc.listPriceUSD && svc.listPriceUSD > svc.priceUSD
                                  ? ((1 - svc.priceUSD / svc.listPriceUSD) * 100).toFixed(0) + "%"
                                  : "—";
                                return (
                                  <tr key={svc.id} className="border-b border-slate-100">
                                    <td className="py-2 pr-3">
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        svc.testType === "ICP" ? "bg-blue-50 text-blue-700" :
                                        svc.testType === "ANTIBACTERIAL" ? "bg-purple-50 text-purple-700" :
                                        svc.testType === "FUNGAL" ? "bg-orange-50 text-orange-700" :
                                        svc.testType === "ODOR" ? "bg-rose-50 text-rose-700" :
                                        svc.testType === "UV" ? "bg-indigo-50 text-indigo-700" :
                                        "bg-slate-50 text-slate-700"
                                      }`}>{svc.testType}</span>
                                    </td>
                                    <td className="py-2 pr-3 font-mono text-slate-600">{svc.testMethod || "—"}</td>
                                    <td className="py-2 pr-3 text-slate-600">{svc.description || "—"}</td>
                                    <td className="py-2 pr-3 text-right font-bold text-emerald-600">{svc.priceUSD ? `$${svc.priceUSD.toFixed(2)}` : "—"}</td>
                                    <td className="py-2 pr-3 text-right text-slate-500">{svc.listPriceUSD ? `$${svc.listPriceUSD.toFixed(2)}` : "—"}</td>
                                    <td className="py-2 pr-3 text-right text-emerald-600 font-semibold">{discount}</td>
                                    <td className="py-2 pr-3 text-center text-slate-600">{svc.turnaroundDays || "—"}</td>
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
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Submission Forms & Documents</h4>
                        <label className="px-3 py-1.5 text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 cursor-pointer">
                          {uploadingDoc ? "Uploading..." : "Upload PDF"}
                          <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" className="hidden"
                            disabled={uploadingDoc}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleDocUpload(lab.id, file);
                              e.target.value = "";
                            }} />
                        </label>
                      </div>

                      {lab.documents && lab.documents.length > 0 ? (
                        <div className="space-y-2">
                          {lab.documents.map((doc: any) => (
                            <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                                  <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                  </svg>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-slate-700">{doc.filename}</p>
                                  <p className="text-xs text-slate-400">
                                    {doc.sizeBytes ? `${(doc.sizeBytes / 1024).toFixed(0)} KB · ` : ""}
                                    Uploaded {new Date(doc.createdAt).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <a href={doc.url || `/api/documents/${doc.id}`} target="_blank" rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                                  Download
                                </a>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDocDelete(lab.id, doc.id, doc.filename); }}
                                  className="text-xs text-red-400 hover:text-red-600 font-medium"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400 italic">No submission forms uploaded yet.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Edit Mode */}
                {isExpanded && editing && (
                  <div className="border-t border-slate-200 px-5 py-4 bg-blue-50/30">
                    <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                      Editing: {lab.name}
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
