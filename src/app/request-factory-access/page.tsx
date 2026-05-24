"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n";

export default function RequestFactoryAccessPage() {
  const { t } = useI18n();
  const T = t.requestFactoryAccessPage;
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
        setError(data.error || T.errorGeneric);
      }
    } catch {
      setError(T.errorNetwork);
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
            <span className="text-2xl font-bold text-white tracking-tight">{T.brandTitle}</span>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">{T.submittedTitle}</h2>
            <p className="text-sm text-slate-500 mb-6">
              {T.submittedBlurb}
            </p>
            <div className="text-xs text-slate-400">
              {T.alreadyHaveAccount}{" "}
              <Link href="/login" className="text-[#00b4c3] hover:underline font-medium">{T.signIn}</Link>
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
            <span className="text-2xl font-bold text-white tracking-tight">{T.brandTitle}</span>
          </div>
          <p className="text-slate-400 text-sm">{T.pageEyebrow}</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-slate-900 mb-1">{T.cardTitle}</h2>
          <p className="text-sm text-slate-500 mb-6">
            {T.cardBlurb}
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Info */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#00b4c3] text-white text-xs font-bold flex items-center justify-center">1</span>
                {T.section1Title}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{T.firstNameLabel} <span className="text-red-500">*</span></label>
                  <input type="text" required value={form.firstName} onChange={e => update("firstName", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                    placeholder={T.firstNamePlaceholder} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{T.lastNameLabel} <span className="text-red-500">*</span></label>
                  <input type="text" required value={form.lastName} onChange={e => update("lastName", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                    placeholder={T.lastNamePlaceholder} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{T.workEmailLabel} <span className="text-red-500">*</span></label>
                  <input type="email" required value={form.email} onChange={e => update("email", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                    placeholder={T.emailPlaceholder} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{T.phoneLabel}</label>
                  <input type="tel" value={form.phone} onChange={e => update("phone", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                    placeholder={T.phonePlaceholder} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{T.jobTitleLabel}</label>
                  <input type="text" value={form.jobTitle} onChange={e => update("jobTitle", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                    placeholder={T.jobTitlePlaceholder} />
                </div>
              </div>
            </div>

            {/* Factory Info */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#00b4c3] text-white text-xs font-bold flex items-center justify-center">2</span>
                {T.section2Title}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 space-y-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">{T.factoryNameLabel} <span className="text-red-500">*</span></label>
                  <input type="text" required value={form.company} onChange={e => update("company", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                    placeholder={T.factoryNamePlaceholder} />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">{T.address1Label} <span className="text-red-500">*</span></label>
                  <input type="text" required value={form.addressLine1} onChange={e => update("addressLine1", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                    placeholder={T.address1Placeholder} />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">{T.address2Label}</label>
                  <input type="text" value={form.addressLine2} onChange={e => update("addressLine2", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                    placeholder={T.address2Placeholder} />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{T.cityLabel} <span className="text-red-500">*</span></label>
                  <input type="text" required value={form.city} onChange={e => update("city", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                    placeholder={T.cityPlaceholder} />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{T.stateLabel}</label>
                  <input type="text" value={form.stateProvince} onChange={e => update("stateProvince", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                    placeholder={T.statePlaceholder} />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{T.postalLabel}</label>
                  <input type="text" value={form.postalCode} onChange={e => update("postalCode", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                    placeholder={T.postalPlaceholder} />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{T.countryLabel} <span className="text-red-500">*</span></label>
                  <select required value={form.country} onChange={e => update("country", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none">
                    <option value="">{T.selectCountry}</option>
                    <optgroup label={T.optgroupManufacturing}>
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
                    <optgroup label={T.optgroupAmericas}>
                      <option value="Mexico">Mexico</option>
                      <option value="Honduras">Honduras</option>
                      <option value="Guatemala">Guatemala</option>
                      <option value="El Salvador">El Salvador</option>
                      <option value="United States">United States</option>
                    </optgroup>
                    <optgroup label={T.optgroupOther}>
                      <option value="Other">Other</option>
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{T.websiteLabel}</label>
                  <input type="text" value={form.website} onChange={e => update("website", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                    placeholder={T.websitePlaceholder} />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{T.capacityLabel}</label>
                  <select value={form.monthlyCapacity} onChange={e => update("monthlyCapacity", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none">
                    <option value="">{T.selectCapacity}</option>
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
                {T.section3Title}
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
                {T.section4Title}
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
                {T.section5Title}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{T.productTypesLabel}</label>
                  <input type="text" value={form.productTypes} onChange={e => update("productTypes", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                    placeholder={T.productTypesPlaceholder} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-2">{T.methodsLabel}</label>
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
              <label className="block text-xs font-medium text-slate-600 mb-1">{T.notesLabel}</label>
              <textarea value={form.notes} onChange={e => update("notes", e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                rows={3} placeholder={T.notesPlaceholder} />
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-[#00b4c3] to-[#009ba8] text-white py-3 rounded-lg font-semibold text-sm hover:shadow-lg hover:shadow-[#00b4c3]/30 transition-all disabled:opacity-50">
              {loading ? T.submittingBtn : T.submitBtn}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">
              {T.alreadyHaveAccount}{" "}
              <Link href="/login" className="text-[#00b4c3] hover:underline font-medium">{T.signIn}</Link>
            </p>
          </div>
        </div>

        <p className="text-center mt-6 text-xs text-slate-500">
          {T.pageFooter}
        </p>
      </div>
    </div>
  );
}
