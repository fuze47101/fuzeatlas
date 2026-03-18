"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n";
import LoginLanguageSwitcher from "@/components/LoginLanguageSwitcher";

export default function RequestAccessPage() {
  const { t } = useI18n();
  const ra = t.requestAccess || ({} as any);

  const [requestType, setRequestType] = useState("BRAND");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    jobTitle: "",
    company: "",
    website: "",
    fabricTypes: "",
    annualVolume: "",
    timeline: "",
    currentAntimicrobial: "",
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
        body: JSON.stringify({ ...form, requestType }),
      });
      const data = await res.json();
      if (data.ok) {
        setSubmitted(true);
      } else {
        setError(data.error || ra.genericError || "Something went wrong. Please try again.");
      }
    } catch {
      setError(ra.networkError || "Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const update = (field: string, value: string) => setForm({ ...form, [field]: value });

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 relative">
        <LoginLanguageSwitcher />
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
            <h2 className="text-xl font-bold text-slate-900 mb-2">{ra.successTitle || "Request Submitted"}</h2>
            <p className="text-sm text-slate-500 mb-6">
              {ra.successMessage || "Thank you for your interest in FUZE. Our team will review your request and reach out to you within 1-2 business days."}{" "}
              <span className="font-medium text-slate-700">{form.email}</span>
            </p>
            <div className="text-xs text-slate-400">
              {ra.alreadyHaveAccount || "Already have an account?"}{" "}
              <Link href="/login" className="text-[#00b4c3] hover:underline font-medium">{ra.signIn || "Sign in"}</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-8 relative">
      <LoginLanguageSwitcher />
      <div className="w-full max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00b4c3] to-[#009ba8] flex items-center justify-center text-white font-black text-lg shadow-lg">
              F
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">FUZE Atlas</span>
          </div>
          <p className="text-slate-400 text-sm">{ra.subtitle || "Brand Portal Access Request"}</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-slate-900 mb-1">{ra.title || "Request Portal Access"}</h2>
          <p className="text-sm text-slate-500 mb-6">
            {ra.description || "Fill out the form below to request access to the FUZE Brand Portal."}
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Account Type Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">I am requesting access as a:</label>
              <div className="flex gap-2">
                {[
                  { key: "BRAND", label: "Brand / Customer", icon: "🏢" },
                  { key: "FACTORY", label: "Factory", icon: "🏭" },
                  { key: "LAB", label: "Laboratory", icon: "🔬" },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setRequestType(opt.key)}
                    className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all border-2 ${
                      requestType === opt.key
                        ? "border-[#00b4c3] bg-[#00b4c3]/5 text-[#00b4c3]"
                        : "border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Personal Info */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#00b4c3] text-white text-xs font-bold flex items-center justify-center">1</span>
                {ra.section1 || "Your Information"}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{ra.firstName || "First Name"} <span className="text-red-500">*</span></label>
                  <input type="text" required value={form.firstName} onChange={e => update("firstName", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                    placeholder={ra.firstNamePlaceholder || "Sarah"} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{ra.lastName || "Last Name"} <span className="text-red-500">*</span></label>
                  <input type="text" required value={form.lastName} onChange={e => update("lastName", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                    placeholder={ra.lastNamePlaceholder || "Chen"} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{ra.workEmail || "Work Email"} <span className="text-red-500">*</span></label>
                  <input type="email" required value={form.email} onChange={e => update("email", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                    placeholder={ra.emailPlaceholder || "sarah@company.com"} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{ra.phone || "Phone"}</label>
                  <input type="tel" value={form.phone} onChange={e => update("phone", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                    placeholder={ra.phonePlaceholder || "+1-555-0100"} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{ra.jobTitle || "Job Title"}</label>
                  <input type="text" value={form.jobTitle} onChange={e => update("jobTitle", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                    placeholder={ra.jobTitlePlaceholder || "VP of Product Development"} />
                </div>
              </div>
            </div>

            {/* Company Info */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#00b4c3] text-white text-xs font-bold flex items-center justify-center">2</span>
                {ra.section2 || "Company Details"}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{ra.companyName || "Company Name"} <span className="text-red-500">*</span></label>
                  <input type="text" required value={form.company} onChange={e => update("company", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                    placeholder={ra.companyPlaceholder || "Acme Clothing Company"} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{ra.website || "Website"}</label>
                  <input type="text" value={form.website} onChange={e => update("website", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                    placeholder={ra.websitePlaceholder || "https://acmeclothing.com"} />
                </div>
              </div>
            </div>

            {/* Program Interest */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#00b4c3] text-white text-xs font-bold flex items-center justify-center">3</span>
                {ra.section3 || "Program Interest"}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{ra.fabricTypes || "Fabric Types of Interest"}</label>
                  <input type="text" value={form.fabricTypes} onChange={e => update("fabricTypes", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                    placeholder={ra.fabricTypesPlaceholder || "Athletic wear, hospitality uniforms, medical textiles..."} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{ra.annualVolume || "Estimated Annual Volume"}</label>
                  <select value={form.annualVolume} onChange={e => update("annualVolume", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none">
                    <option value="">{t.common?.selectOption || "Select..."}</option>
                    <option value="Under 100,000 meters">{ra.volumeUnder100k || "Under 100,000 meters"}</option>
                    <option value="100,000 - 500,000 meters">{ra.volume100kTo500k || "100,000 - 500,000 meters"}</option>
                    <option value="500,000 - 1,000,000 meters">{ra.volume500kTo1m || "500,000 - 1,000,000 meters"}</option>
                    <option value="Over 1,000,000 meters">{ra.volumeOver1m || "Over 1,000,000 meters"}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{ra.timeline || "Timeline"}</label>
                  <select value={form.timeline} onChange={e => update("timeline", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none">
                    <option value="">{t.common?.selectOption || "Select..."}</option>
                    <option value="Immediate - ready to test">{ra.timelineImmediate || "Immediate - ready to test"}</option>
                    <option value="1-3 months">{ra.timeline1to3 || "1-3 months"}</option>
                    <option value="3-6 months">{ra.timeline3to6 || "3-6 months"}</option>
                    <option value="Exploratory - learning about FUZE">{ra.timelineExploratory || "Exploratory - learning about FUZE"}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{ra.currentAntimicrobial || "Current Antimicrobial (if any)"}</label>
                  <input type="text" value={form.currentAntimicrobial} onChange={e => update("currentAntimicrobial", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                    placeholder={ra.antimicrobialPlaceholder || "e.g. Silvadur, Ultra-Fresh, Sanitized, none"} />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-xs font-medium text-slate-600 mb-1">{ra.additionalNotes || "Additional Notes"}</label>
                <textarea value={form.notes} onChange={e => update("notes", e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                  rows={3} placeholder={ra.notesPlaceholder || "Anything else you'd like us to know about your program needs..."} />
              </div>
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-[#00b4c3] to-[#009ba8] text-white py-3 rounded-lg font-semibold text-sm hover:shadow-lg hover:shadow-[#00b4c3]/30 transition-all disabled:opacity-50">
              {loading ? (ra.submitting || "Submitting...") : (ra.submitButton || "Submit Access Request")}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">
              {ra.alreadyHaveAccount || "Already have an account?"}{" "}
              <Link href="/login" className="text-[#00b4c3] hover:underline font-medium">{ra.signIn || "Sign in"}</Link>
            </p>
          </div>
        </div>

        <p className="text-center mt-6 text-xs text-slate-500">
          {ra.footer || "FUZE Biotech Inc. · Textile Intelligence Platform"}
        </p>
      </div>
    </div>
  );
}
