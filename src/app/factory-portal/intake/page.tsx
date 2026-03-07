"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function FactoryIntakePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    fabricName: "",
    weight: "",
    content: "",
    supplier: "",
    notes: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (user?.role !== "FACTORY_USER" && user?.role !== "FACTORY_MANAGER") {
      router.push("/dashboard");
      return;
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("fabricName", form.fabricName);
      formData.append("weight", form.weight);
      formData.append("content", form.content);
      formData.append("supplier", form.supplier);
      formData.append("notes", form.notes);
      if (file) {
        formData.append("file", file);
      }

      const res = await fetch("/api/factory-portal/intake", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.ok) {
        setSubmitted(true);
      } else {
        setError(data.error || "Something went wrong");
      }
    } catch (e) {
      setError("Failed to submit fabric");
    } finally {
      setLoading(false);
    }
  };

  const update = (field: string, value: string) => {
    setForm({ ...form, [field]: value });
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
            <h2 className="text-xl font-bold text-slate-900 mb-2">Fabric Submitted</h2>
            <p className="text-sm text-slate-500 mb-6">
              Your fabric intake has been submitted successfully. You'll be able to track its progress in the submissions section.
            </p>
            <Link href="/factory-portal/submissions"
              className="text-[#00b4c3] hover:underline font-medium text-sm">
              View submissions →
            </Link>
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
          <div className="flex items-center gap-2 justify-center mb-3 text-sm text-slate-400">
            <Link href="/factory-portal" className="hover:text-[#00b4c3]">Factory Portal</Link>
            <span>/</span>
            <span>Submit Fabric</span>
          </div>
          <h1 className="text-3xl font-black text-white mb-2">Submit Fabric for FUZE Treatment</h1>
          <p className="text-slate-400">Provide fabric details and upload sample documentation</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Fabric Info */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#00b4c3] text-white text-xs font-bold flex items-center justify-center">1</span>
                Fabric Information
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Fabric Name <span className="text-red-500">*</span></label>
                  <input type="text" required value={form.fabricName} onChange={e => update("fabricName", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                    placeholder="e.g., Premium Knit Jersey" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Weight (GSM)</label>
                    <input type="text" value={form.weight} onChange={e => update("weight", e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                      placeholder="e.g., 180" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Fiber Content</label>
                    <input type="text" value={form.content} onChange={e => update("content", e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                      placeholder="e.g., 100% Polyester" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Supplier</label>
                  <input type="text" value={form.supplier} onChange={e => update("supplier", e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                    placeholder="Supplier name (optional)" />
                </div>
              </div>
            </div>

            {/* Documentation */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#00b4c3] text-white text-xs font-bold flex items-center justify-center">2</span>
                Documentation
              </h3>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">Upload Intake Form or Sample (Optional)</label>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-[#00b4c3] transition-colors cursor-pointer"
                  onClick={() => document.getElementById("file-input")?.click()}>
                  <svg className="w-8 h-8 mx-auto mb-2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm text-slate-600">{file ? file.name : "Drop file or click to upload"}</p>
                  <p className="text-xs text-slate-400 mt-1">PDF, JPG, PNG up to 10MB</p>
                </div>
                <input id="file-input" type="file" onChange={e => setFile(e.target.files?.[0] || null)}
                  className="hidden" accept=".pdf,.jpg,.jpeg,.png" />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Additional Notes</label>
              <textarea value={form.notes} onChange={e => update("notes", e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
                rows={3} placeholder="Any special requirements or notes about this fabric..." />
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-[#00b4c3] to-[#009ba8] text-white py-3 rounded-lg font-semibold text-sm hover:shadow-lg hover:shadow-[#00b4c3]/30 transition-all disabled:opacity-50">
              {loading ? "Submitting..." : "Submit Fabric"}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">
              <Link href="/factory-portal" className="text-[#00b4c3] hover:underline">Back to Factory Portal</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
