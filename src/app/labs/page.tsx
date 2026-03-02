"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n";

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
  icpApproved: boolean;
  abApproved: boolean;
  fungalApproved: boolean;
  odorApproved: boolean;
  uvApproved: boolean;
  notes?: string;
  _count: { testRuns: number };
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

export default function LabDirectoryPage() {
  const { t } = useI18n();
  const [labs, setLabs] = useState<Lab[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCountry, setFilterCountry] = useState("");
  const [filterCapability, setFilterCapability] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expandedLab, setExpandedLab] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "", address: "", city: "", state: "", country: "", region: "",
    website: "", email: "", phone: "", accreditations: "", notes: "",
    icpApproved: false, abApproved: false, fungalApproved: false,
    odorApproved: false, uvApproved: false,
  });

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

  useEffect(() => { loadLabs(); }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      loadLabs(filterCountry, filterCapability, search);
    }, 300);
    return () => clearTimeout(debounce);
  }, [filterCountry, filterCapability, search]);

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/labs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (d.ok) {
        setShowAdd(false);
        setForm({ name: "", address: "", city: "", state: "", country: "", region: "",
          website: "", email: "", phone: "", accreditations: "", notes: "",
          icpApproved: false, abApproved: false, fungalApproved: false,
          odorApproved: false, uvApproved: false });
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

  const capCount = (lab: Lab) =>
    [lab.icpApproved, lab.abApproved, lab.fungalApproved, lab.odorApproved, lab.uvApproved]
      .filter(Boolean).length;

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
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
        >
          + Add Lab
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{success}</div>}

      {/* Add Lab Form */}
      {showAdd && (
        <div className="mb-6 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-4">Add New Lab</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Lab Name <span className="text-red-500">*</span></label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. ITS Taiwan (Intertek)" autoFocus />
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
            <div className="sm:col-span-2">
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

          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving || !form.name.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving..." : "Add Lab"}
            </button>
            <button onClick={() => setShowAdd(false)}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">
              {t.common.cancel}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search labs by name, city, or country..."
          className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={filterCountry}
          onChange={e => setFilterCountry(e.target.value)}
          className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Countries</option>
          {countries.map(c => (
            <option key={c.name} value={c.name}>{c.name} ({c.count})</option>
          ))}
        </select>
        <select
          value={filterCapability}
          onChange={e => setFilterCapability(e.target.value)}
          className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
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
            return (
              <div key={lab.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                {/* Lab Header Row */}
                <div
                  className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => setExpandedLab(isExpanded ? null : lab.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-bold text-slate-900 truncate">{lab.name}</h3>
                      {lab._count.testRuns > 0 && (
                        <span className="flex-shrink-0 px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full font-medium">
                          {lab._count.testRuns} tests
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

                  {/* Capability badges */}
                  <div className="flex items-center gap-1.5 ml-4">
                    {CAPABILITY_BADGES.map(({ key, label, bg, text }) =>
                      (lab as any)[key] ? (
                        <span key={key} className={`px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
                          {label}
                        </span>
                      ) : null
                    )}
                    <svg
                      className={`w-5 h-5 text-slate-400 transition-transform ml-2 ${isExpanded ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-slate-200 px-5 py-4">
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
                        {!lab.website && !lab.email && !lab.phone && (
                          <p className="text-sm text-slate-400">No contact info</p>
                        )}
                      </div>

                      {/* Accreditations & Capabilities */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Accreditations</h4>
                        {lab.accreditations ? (
                          <div className="flex flex-wrap gap-1.5">
                            {lab.accreditations.split(",").map((acc, i) => (
                              <span key={i} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded-full font-medium">
                                {acc.trim()}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400">None listed</p>
                        )}

                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mt-4">Approved Tests</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {CAPABILITY_BADGES.map(({ key, label, bg, text }) => (
                            <span key={key} className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              (lab as any)[key] ? `${bg} ${text}` : "bg-slate-100 text-slate-400 line-through"
                            }`}>
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Stats & Notes */}
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
