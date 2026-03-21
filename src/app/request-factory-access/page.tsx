"use client";

import { useState } from "react";
import Link from "next/link";

export default function RequestFactoryAccessPage() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    jobTitle: "",
    company: "",
    website: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    stateProvince: "",
    postalCode: "",
    country: "",
    capabilities: [] as string[],
    certifications: [] as string[],
    productTypes: "",
    monthlyCapacity: "",
    fuzeApplicationMethod: [] as string[],
    notes: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          requestType: "FACTORY",
          capabilities: form.capabilities.join(","),
          certifications: form.certifications.join(","),
          fuzeApplicationMethod: form.fuzeApplicationMethod.join(","),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSubmitted(true);
      } else {
        setError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const update = (field: string, value: string | string[]) => {
    setForm({ ...form, [field]: value });
  };

  const toggleCheckbox = (field: "capabilities" | "certifications" | "fuzeApplicationMethod", value: string) => {
    const current = form[field] as string[];
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    setForm({ ...form, [field]: updated });
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00b4c3] to-[#009ba8] flex items-center justify-center text-white font-black text-lg shadow-lg">
              F
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">FUZE Atlas</span>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Request Submitted</h2>
            <p className="text-sm text-slate-500 mb-6">
              Thank you for your interest in becoming a FUZE partner factory. Our team will review your application and reach out within 2-3 business days.
            </p>
            <div className="text-xs text-slate-400">
              Already have an account?{" "}
              <Link href="/login" className="text-[#00b4c3] hover:underline font-medium">Sign in</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-8">
      <div className="w-full max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00b4c3] to-[#009ba8] flex items-center justify-center text-white font-black text-lg shadow-lg">
              F
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">FUZE Atlas</span>
          </div>
          <p className="text-slate-400 text-sm">Factory Portal Access Request</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-slate-900 mb-1">Request Portal Access</h2>
          <p className="text-sm text-slate-500 mb-6">
            Fill out the form below to request access to the FUZE Factory Portal. Manage fabric submissions, track FUZE treatments, and collaborate with brands.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Info */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#00b4c3] text-white text-xs font-bold flex items-center justify-center">1</span>
                Your Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">First Name <span className="text-red-500">*</span></label>
                  <input type="text" required value={form.firstName} onChange={e => update("firstName", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                    placeholder="John" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Last Name <span className="text-red-500">*</span></label>
                  <input type="text" required value={form.lastName} onChange={e => update("lastName", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                    placeholder="Smith" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Work Email <span className="text-red-500">*</span></label>
                  <input type="email" required value={form.email} onChange={e => update("email", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                    placeholder="john@factory.com" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                  <input type="tel" value={form.phone} onChange={e => update("phone", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                    placeholder="+86-10-1234-5678" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Job Title</label>
                  <input type="text" value={form.jobTitle} onChange={e => update("jobTitle", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                    placeholder="Production Manager" />
                </div>
              </div>
            </div>

            {/* Factory Info */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#00b4c3] text-white text-xs font-bold flex items-center justify-center">2</span>
                Factory Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 space-y-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Factory / Mill Name <span className="text-red-500">*</span></label>
                  <input type="text" required value={form.company} onChange={e => update("company", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                    placeholder="XYZ Textile Mill" />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Address Line 1 <span className="text-red-500">*</span></label>
                  <input type="text" required value={form.addressLine1} onChange={e => update("addressLine1", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                    placeholder="Street address" />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Address Line 2</label>
                  <input type="text" value={form.addressLine2} onChange={e => update("addressLine2", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                    placeholder="Suite, building, floor, etc." />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">City <span className="text-red-500">*</span></label>
                  <input type="text" required value={form.city} onChange={e => update("city", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                    placeholder="e.g., Shanghai" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">State / Province / Region</label>
                  <input type="text" value={form.stateProvince} onChange={e => update("stateProvince", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                    placeholder="e.g., Zhejiang" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Postal Code</label>
                  <input type="text" value={form.postalCode} onChange={e => update("postalCode", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                    placeholder="e.g., 200000" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Country <span className="text-red-500">*</span></label>
                  <select required value={form.country} onChange={e => update("country", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none">
                    <option value="">Select country...</option>
                    <optgroup label="Major Manufacturing Countries">
                      <option value="China">China</option>
                      <option value="Taiwan">Taiwan</option>
                      <option value="Vietnam">Vietnam</option>
                      <option value="Bangladesh">Bangladesh</option>
                      <option value="India">India</option>
                      <option value="Indonesia">Indonesia</option>
                      <option value="Thailand">Thailand</option>
                      <option value="Turkey">Turkey</option>
                      <option value="Pakistan">Pakistan</option>
                      <option value="Cambodia">Cambodia</option>
                      <option value="Sri Lanka">Sri Lanka</option>
                      <option value="Myanmar">Myanmar</option>
                      <option value="South Korea">South Korea</option>
                      <option value="Japan">Japan</option>
                      <option value="Philippines">Philippines</option>
                      <option value="Malaysia">Malaysia</option>
                    </optgroup>
                    <optgroup label="Americas">
                      <option value="Mexico">Mexico</option>
                      <option value="Honduras">Honduras</option>
                      <option value="Guatemala">Guatemala</option>
                      <option value="El Salvador">El Salvador</option>
                      <option value="United States">United States</option>
                    </optgroup>
                    <optgroup label="Other">
                      <option value="Other">Other</option>
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Website</label>
                  <input type="text" value={form.website} onChange={e => update("website", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                    placeholder="https://factory.com" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Monthly Production Capacity</label>
                  <select value={form.monthlyCapacity} onChange={e => update("monthlyCapacity", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none">
                    <option value="">Select...</option>
                    <option value="Under 100k meters">Under 100k meters</option>
                    <option value="100k-500k meters">100k-500k meters</option>
                    <option value="500k-1M meters">500k-1M meters</option>
                    <option value="Over 1M meters">Over 1M meters</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Capabilities */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#00b4c3] text-white text-xs font-bold flex items-center justify-center">3</span>
                Factory Capabilities
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {["Knitting", "Weaving", "Dyeing", "Finishing", "Printing", "Garment Assembly"].map((cap) => (
                  <label key={cap} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.capabilities.includes(cap)}
                      onChange={() => toggleCheckbox("capabilities", cap)}
                      className="w-4 h-4 rounded border-slate-300 text-[#00b4c3] focus:ring-[#00b4c3]"
                    />
                    <span className="text-sm text-slate-700">{cap}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Certifications */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#00b4c3] text-white text-xs font-bold flex items-center justify-center">4</span>
                Certifications
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {["ISO 9001", "ISO 14001", "OEKO-TEX", "GOTS", "BSCI", "WRAP"].map((cert) => (
                  <label key={cert} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.certifications.includes(cert)}
                      onChange={() => toggleCheckbox("certifications", cert)}
                      className="w-4 h-4 rounded border-slate-300 text-[#00b4c3] focus:ring-[#00b4c3]"
                    />
                    <span className="text-sm text-slate-700">{cert}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Product Types & FUZE Interest */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#00b4c3] text-white text-xs font-bold flex items-center justify-center">5</span>
                Products & FUZE Interest
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Product Types</label>
                  <input type="text" value={form.productTypes} onChange={e => update("productTypes", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                    placeholder="e.g., Athletic wear, Denim, Medical textiles" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-2">FUZE Application Methods of Interest</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {["Pad/Exhaust", "Spray", "Jeanologia", "Wash Cycle", "Yarn Dye"].map((method) => (
                      <label key={method} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.fuzeApplicationMethod.includes(method)}
                          onChange={() => toggleCheckbox("fuzeApplicationMethod", method)}
                          className="w-4 h-4 rounded border-slate-300 text-[#00b4c3] focus:ring-[#00b4c3]"
                        />
                        <span className="text-sm text-slate-700">{method}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Additional Notes</label>
              <textarea value={form.notes} onChange={e => update("notes", e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                rows={3} placeholder="Tell us about your factory and why you're interested in partnering with FUZE..." />
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-[#00b4c3] to-[#009ba8] text-white py-3 rounded-lg font-semibold text-sm hover:shadow-lg hover:shadow-[#00b4c3]/30 transition-all disabled:opacity-50">
              {loading ? "Submitting..." : "Submit Access Request"}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">
              Already have an account?{" "}
              <Link href="/login" className="text-[#00b4c3] hover:underline font-medium">Sign in</Link>
            </p>
          </div>
        </div>

        <p className="text-center mt-6 text-xs text-slate-500">
          FUZE Biotech Inc. &middot; Textile Intelligence Platform
        </p>
      </div>
    </div>
  );
}
